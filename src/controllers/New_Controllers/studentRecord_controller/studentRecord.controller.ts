import mongoose from "mongoose";
import StudentNewModel from "../../../models/New_Model/StudentModel/studentNew.model.js";
import StudentRecordModel from "../../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js";
import FeeTransactionModel from "../../../models/New_Model/FeeTransactionReceipt_model/feeTransactionReceipt.model.js";
import FeeStructureModel from "../../../models/New_Model/FeeStructureModel/FeeStructure.model.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/shoolModel.model.js";
import ClassModel from "../../../models/New_Model/SchoolModel/classModel.model.js";
import SectionModel from "../../../models/New_Model/SchoolModel/section.model.js";
// import { uploadImageToS3 } from "../../../Utils/s3upload.js";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";
// import { createLedgerEntry } from "../financeLedger_controller/financeLedger.controller.js";
// import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import { FinanceLedgerModel } from "../../../models/New_Model/financeLedger_model/financeLedger.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";
import { createLedgerEntry } from "../financeLedger_controller/financeLedger.controller.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";




const processFiles = async (filesArray: any[]) => {
    if (!filesArray || filesArray.length === 0) return [];
    return await Promise.all(
        filesArray.map(async (file) => {
            const uploadData = await uploadFileToS3New(file);
            const type = file.mimetype.startsWith("image") ? "image" : "pdf";
            return {
                url: uploadData.url,
                key: uploadData.key,
                type: type,
                originalName: file.originalname,
                uploadedAt: new Date()
            };
        })
    );
};


// Helper: Generate Receipt Number (REC-YYYY-0001)
const generateReceiptNo = async (schoolId: string, session: any) => {
    const year = new Date().getFullYear();
    const lastTrans = await FeeTransactionModel.findOne()
        .sort({ createdAt: -1 })
        .session(session);

    let nextNum = 1;
    if (lastTrans && lastTrans.receiptNo) {
        const parts = lastTrans.receiptNo.split('-');
        // Expected format: REC-2025-0001
        if (parts.length === 3 && parts[1] === String(year)) {
            nextNum = parseInt(parts[2]!) + 1;
        }
    }
    return `REC-${year}-${String(nextNum).padStart(4, '0')}`;
};

// MASTER FEE COLLECTION CONTROLLER
// ==========================================
export const collectFeeAndManageRecord = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let {
            schoolId, studentId, studentName, classId, sectionId,
            amount, paymentMode, cashDenominations,
            referenceNumber, bankName, chequeDate, remarks,
            // Configuration
            isBusApplicable, busPoint,
            manualDueAllocation, // Boolean: True = use 'paidHeads', False = Auto FIFO
            paidHeads, // Required if manualDueAllocation is true

            newOld
        } = req.body;

        const files: any[] = req.files as any[]

        amount = Number(amount || 0);
        manualDueAllocation = manualDueAllocation === true || manualDueAllocation === "true";
        isBusApplicable = isBusApplicable === true || isBusApplicable === "true";


        if (cashDenominations && typeof cashDenominations === "string") {
            cashDenominations = JSON.parse(cashDenominations);
        }

        if (paidHeads && typeof paidHeads === "string") {
            paidHeads = JSON.parse(paidHeads);
        }



        const payingAmount = Number(amount || 0);

        // 1. BASIC VALIDATION
        if (!schoolId || !studentId || !classId || !paymentMode) {
            throw new Error("Missing required fields: schoolId, studentId, classId, paymentMode");
        }

        if (!newOld) {
            return res.status(400).json({ ok: false, message: "newOld is required, it should be either new or old only " });
        }





        // 2. GET ACADEMIC YEAR
        const schoolDoc = await SchoolModel.findById(schoolId).session(session);
        if (!schoolDoc) throw new Error("School not found");
        const currentYear = schoolDoc.currentAcademicYear;

        // 3. CASH TALLY CHECK (Mandatory for Cash)
        if (paymentMode.toLowerCase() === "cash") {
            if (!cashDenominations) throw new Error("Cash denominations required");

            // Handle FormData string parsing
            let denoms = typeof cashDenominations === 'string' ? JSON.parse(cashDenominations) : cashDenominations;

            const tallyTotal = denoms.reduce((sum: any, item: any) => sum + (Number(item.label) * Number(item.count)), 0);
            if (tallyTotal !== payingAmount) {
                throw new Error(`Cash Tally Mismatch. Entered: ${payingAmount}, Counted: ${tallyTotal}`);
            }
        }

        // 4. FIND OR INITIALIZE STUDENT RECORD
        let studentRecord: any = await StudentRecordModel.findOne({
            schoolId, studentId, academicYear: currentYear
        }).session(session);

        if (studentRecord && studentRecord?.isActive === false) {
            throw new Error("Action Denied: This Student Record is INACTIVE. Please activate it first to collect fees.");
        }

        // let isNewRecord = false; // not used so commented

        // If not found, we prepare to create it using Master Fees
        if (!studentRecord) {
            // _isNewRecord = true;

            // Get Class & Section Names
            const cDoc: any = await ClassModel.findById(classId).session(session);
            let sName = "N/A";
            if (sectionId) {
                const sDoc: any = await SectionModel.findById(sectionId).session(session);
                sName = sDoc.name;
            }

            // Get Master Fee Structure
            const masterFee = await FeeStructureModel.findOne({ schoolId, classId, type: newOld }).session(session);
            if (!masterFee) throw new Error("Fee Structure not found for this class");

            // Initialize Structure (Before Concession)
            const busApp = (isBusApplicable === 'true' || isBusApplicable === true);
            const initialStructure = {
                admissionFee: Number(masterFee.feeHead.admissionFee || 0),
                firstTermAmt: Number(masterFee.feeHead.firstTermAmt || 0),
                secondTermAmt: Number(masterFee.feeHead.secondTermAmt || 0),
                busFirstTermAmt: busApp ? Number(masterFee.feeHead.busFirstTermAmt || 0) : 0,
                busSecondTermAmt: busApp ? Number(masterFee.feeHead.busSecondTermAmt || 0) : 0,
            };

            // Initialize Record in Memory
            studentRecord = new StudentRecordModel({
                schoolId, studentId, academicYear: currentYear,
                classId, sectionId: sectionId || null,
                studentName: studentName || null,
                className: cDoc.name, sectionName: sName,
                isActive: true,
                newOld: newOld?.toLowerCase() || "new",
                feeStructure: initialStructure,
                feePaid: { admissionFee: 0, firstTermAmt: 0, secondTermAmt: 0, busFirstTermAmt: 0, busSecondTermAmt: 0 },
                concession: { isApplied: false },
                isBusApplicable: busApp,
                busPoint
            });
        }

        // 5. APPLY CONCESSION LOGIC (Only if Concession exists & Not fully paid)
        // This runs every time to ensure structure reflects the concession.
        // Priority: Second Term -> First Term -> Admission -> Bus

        // if (studentRecord.concession && studentRecord.concession.isApplied) {
        //     let discount = studentRecord.concession.inAmount || 0;

        //     // Reset to prevent double counting? Ideally, we should recalculate from Master base.
        //     // But assuming feeStructure is the "Current Target", we apply reduction.
        //     // CAUTION: For robustness, fetch Master again if updating, but let's assume structure is mutable.

        //     // Note: If record is existing, feeStructure might already be reduced. 
        //     // We only run this logic if it's a NEW record OR if we want to force re-calc.
        //     // For safety in this controller, we assume feeStructure is the TARGET to pay.

        //     // Let's execute the Reduction on the Memory Object if it's NEW.
        //     if (isNewRecord && discount > 0) {
        //         let str = studentRecord.feeStructure;

        //         // 1. Reduce Second Term
        //         if (str.secondTermAmt >= discount) {
        //             str.secondTermAmt -= discount;
        //             discount = 0;
        //         } else {
        //             discount -= str.secondTermAmt;
        //             str.secondTermAmt = 0;
        //         }

        //         // 2. Reduce First Term
        //         if (discount > 0) {
        //             if (str.firstTermAmt >= discount) {
        //                 str.firstTermAmt -= discount;
        //                 discount = 0;
        //             } else {
        //                 discount -= str.firstTermAmt;
        //                 str.firstTermAmt = 0;
        //             }
        //         }

        //         // 3. Reduce Admission
        //         if (discount > 0) {
        //             if (str.admissionFee >= discount) {
        //                 str.admissionFee -= discount;
        //                 discount = 0;
        //             } else {
        //                 discount -= str.admissionFee;
        //                 str.admissionFee = 0;
        //             }
        //         }

        //         // 4. Reduce Bus (If applicable & logic allows)
        //         if (discount > 0 && studentRecord.isBusApplicable) {
        //             if (str.busFirstTermAmt >= discount) {
        //                 str.busFirstTermAmt -= discount;
        //             } else {
        //                 // Stop here or throw error "Concession exceeds Fee"
        //                 // throw new Error("Concession amount exceeds total fee");
        //             }
        //         }
        //     }
        // }



        //  5. NEW APPLY CONCESSION LOGIC

        const currentPaidCheck =
            studentRecord.feePaid.admissionFee +
            studentRecord.feePaid.firstTermAmt +
            studentRecord.feePaid.secondTermAmt +
            studentRecord.feePaid.busFirstTermAmt +
            studentRecord.feePaid.busSecondTermAmt;

        if (currentPaidCheck === 0 && studentRecord.concession && studentRecord.concession.isApplied) {

            let discount = studentRecord?.concession?.inAmount || 0;

            // We modify 'studentRecord.feeStructure' in memory BEFORE allocation starts
            let str = studentRecord.feeStructure;

            // Only run reduction if it hasn't been reduced already.
            // How to know? We check if Master Fee > Current Fee Structure.
            // But simpler: just run the waterfall logic if discount > 0.

            // Waterfall Reduction Logic (Safe to run because Paid is 0)
            if (discount > 0) {
                // 1. Reduce Second Term
                if (str.secondTermAmt >= discount) {
                    str.secondTermAmt -= discount;
                    discount = 0;
                } else {
                    discount -= str.secondTermAmt;
                    str.secondTermAmt = 0;
                }

                // 2. Reduce First Term
                if (discount > 0) {
                    if (str.firstTermAmt >= discount) {
                        str.firstTermAmt -= discount;
                        discount = 0;
                    } else {
                        discount -= str.firstTermAmt;
                        str.firstTermAmt = 0;
                    }
                }

                // 3. Reduce Admission
                if (discount > 0) {
                    if (str.admissionFee >= discount) {
                        str.admissionFee -= discount;
                        discount = 0;
                    } else {
                        discount -= str.admissionFee;
                        str.admissionFee = 0;
                    }
                }

                // 4. Reduce Bus (Optional)
                if (discount > 0 && studentRecord?.isBusApplicable) {
                    if (str.busFirstTermAmt >= discount) {
                        str.busFirstTermAmt -= discount;
                    } else {
                        str.busFirstTermAmt = 0;
                    }
                }

                if (discount > 0 && studentRecord?.isBusApplicable) {
                    if (str.busSecondTermAmt >= discount) {
                        str.busSecondTermAmt -= discount;
                    } else {
                        str.busSecondTermAmt = 0;
                    }
                }
            }
        }

        // 6. PAYMENT ALLOCATION (FIFO or Manual)
        let receiptAllocationList = [];
        let remainingToPay = payingAmount;

        // Heads Priority for FIFO
        // const priority = ['admissionFee', 'busFirstTermAmt', 'firstTermAmt', 'busSecondTermAmt', 'secondTermAmt'];


        // NEWLY DDED LOGIC 
        // Calculate Total Pending Dues
        let totalStructure = 0;
        let totalPaid = 0;

        const s = studentRecord.feeStructure;
        const p = studentRecord.feePaid;

        // Summing manually to be safe
        totalStructure = s.admissionFee + s.firstTermAmt + s.secondTermAmt +
            (studentRecord.isBusApplicable ? s.busFirstTermAmt : 0) +
            (studentRecord.isBusApplicable ? s.busSecondTermAmt : 0);

        totalPaid = p.admissionFee + p.firstTermAmt + p.secondTermAmt +
            p.busFirstTermAmt + p.busSecondTermAmt;

        const totalPending = totalStructure - totalPaid;

        if (payingAmount > totalPending) {
            throw new Error(`Overpayment Rejected. Total Pending Dues: ${totalPending}, Entered Amount: ${payingAmount}`);
        }
        // END OF NEWLY ADDED LOGIC


        if (remainingToPay > 0) {
            if (manualDueAllocation === 'true' || manualDueAllocation === true) {
                // MANUAL MODE
                if (!paidHeads) throw new Error("paidHeads required for Manual Allocation");

                // Validate Manual Sum matches Amount
                // let manualSum = Object.values(paidHeads).reduce((a,b)=>a+Number(b),0);
                // if(manualSum !== remainingToPay) throw Error("Mismatch"); 

                // for (const [head, val] of Object.entries(paidHeads)) {
                //     const payVal = Number(val);
                //     const target = studentRecord.feeStructure[head];
                //     const paid = studentRecord.feePaid[head];
                //     const pending = target - paid;

                //     if (payVal > pending) throw new Error(`Overpayment on ${head}. Due: ${pending}, Paying: ${payVal}`);

                //     studentRecord.feePaid[head] += payVal;
                //     receiptAllocationList.push({ feeHead: head, amount: payVal });
                // }


                let manualSum = 0;
                let parsedHeads = typeof paidHeads === 'string' ? JSON.parse(paidHeads) : paidHeads;

                for (const val of Object.values(parsedHeads)) manualSum += Number(val);
                if (manualSum !== payingAmount) throw new Error("Manual allocation sum does not match Amount");

                for (const [head, val] of Object.entries(parsedHeads)) {
                    const payVal = Number(val);
                    if (payVal > 0) {
                        // Head-specific overpayment check
                        const headDue = studentRecord.feeStructure[head] - studentRecord.feePaid[head];
                        if (payVal > headDue) {
                            throw new Error(`Overpayment on '${head}'. Due: ${headDue}, Paying: ${payVal}`);
                        }

                        studentRecord.feePaid[head] += payVal;
                        receiptAllocationList.push({ feeHead: head, amount: payVal });
                    }
                }

            } else {
                // FIFO MODE
                const priority = ['admissionFee', 'busFirstTermAmt', 'firstTermAmt', 'busSecondTermAmt', 'secondTermAmt'];

                for (const head of priority) {
                    if (remainingToPay <= 0) break;

                    const target = studentRecord.feeStructure[head] || 0;
                    const paid = studentRecord.feePaid[head] || 0;
                    const due = target - paid;

                    if (due > 0) {
                        const pay = Math.min(remainingToPay, due);
                        studentRecord.feePaid[head] += pay;
                        receiptAllocationList.push({ feeHead: head, amount: pay });
                        remainingToPay -= pay;
                    }
                }

                // If money left over -> Overpayment
                if (remainingToPay > 0) {
                    throw new Error(`Overpayment! Excess Amount: ${remainingToPay}. Total Dues are cleared.`);
                }
            }
        }

        // 7. CALCULATE DUES & STATUS
        const str = studentRecord.feeStructure;
        const pd = studentRecord.feePaid;

        const newDues = {
            admissionDues: str.admissionFee - pd.admissionFee, // Specific field for admission

            firstTermDues: str.firstTermAmt - pd.firstTermAmt,
            secondTermDues: str.secondTermAmt - pd.secondTermAmt,

            busfirstTermDues: str.busFirstTermAmt - pd.busFirstTermAmt,
            busSecondTermDues: str.busSecondTermAmt - pd.busSecondTermAmt
        };

        studentRecord.dues = newDues;
        studentRecord.isFullyPaid = (
            newDues.admissionDues + newDues.firstTermDues + newDues.secondTermDues + newDues.busfirstTermDues + newDues.busSecondTermDues <= 0
        );

        // 8. SAVE RECORD
        await studentRecord.save({ session });

        await StudentNewModel.findByIdAndUpdate(
            studentId,
            {
                $set: {
                    currentClassId: studentRecord.classId,
                    currentSectionId: studentRecord.sectionId,
                    isActive: true // Ensure they are active if paying fees
                }
            },
            { session }
        );

        // 9. GENERATE RECEIPT (If Paid > 0)
        let receipt = null;
        if (payingAmount > 0) {
            const receiptNo = await generateReceiptNo(schoolId, session);

            // Determine Status
            let status = "success";
            if (paymentMode.toLowerCase() === 'cheque') status = "pending";

            // receipt = await FeeTransactionModel.create([{
            //     schoolId,
            //     studentId,
            //     recordId: studentRecord._id,
            //     academicYear: currentYear,
            //     receiptNo,
            //     paymentDate: new Date(),
            //     paymentMode: paymentMode.toLowerCase(),
            //     amountPaid: payingAmount,
            //     allocation: receiptAllocationList,

            //     cashDenominations: paymentMode.toLowerCase() === "cash"
            //         ? (typeof cashDenominations === 'string' ? JSON.parse(cashDenominations) : cashDenominations)
            //         : [],

            //     referenceNumber, bankName, chequeDate,
            //     collectedBy: req.user._id,
            //     remarks,
            //     status
            // }], { session });


            const uploadedProof = await processFiles(files);

            // --- CHANGED FROM .create() TO new Model() ---
            const newReceiptEntry = new FeeTransactionModel({
                schoolId,
                studentId,
                recordId: studentRecord._id,
                academicYear: currentYear,
                receiptNo,
                paymentDate: new Date(),
                paymentMode: paymentMode.toLowerCase(),
                amountPaid: payingAmount,
                allocation: receiptAllocationList,

                proofUpload: uploadedProof || [],

                cashDenominations: paymentMode.toLowerCase() === "cash"
                    ? (typeof cashDenominations === 'string' ? JSON.parse(cashDenominations) : cashDenominations)
                    : [],

                referenceNumber, bankName, chequeDate,
                collectedBy: req.user!._id,
                remarks,
                status
            });

            // Save using the session
            receipt = await newReceiptEntry.save({ session });
            // Now 'receipt' is a single Object. You can use receipt._id


            // ---------------------------------------------------------
            // 10. FINANCE LEDGER INTEGRATION (Money In)
            // ---------------------------------------------------------

            // Note: Since createLedgerEntry doesn't natively support Mongoose Sessions in the Helper I gave,
            // we should technically pass 'session' to it, or just await it here.
            // Since your helper uses .save(), it might be outside the transaction scope unless updated.
            // However, for simplicity now, let's call it here. 
            // If it fails, we throw Error to trigger abortTransaction.

            const ledgerEntry = await createLedgerEntry({
                schoolId,
                academicYear: currentYear!,
                transactionType: "CREDIT", // Fee = Credit (Money In)
                amount: payingAmount,
                date: new Date(),
                referenceModel: "FeeTransactionModel", // Linking to the Receipt/Transaction
                referenceId: receipt._id, // Use the ID of the created receipt
                // studentId: studentId, // Link the student
                studentRecordId: studentRecord._id, // Link the Academic Record
                feeReceiptId: newReceiptEntry._id,
                category: "Student Fee", // Or specific head like "Term 1 Fee"
                section: "student_record", // or "income"
                paymentMode: paymentMode.toLowerCase(),
                description: remarks || `Fee Collection - Receipt #${receiptNo}`,
                createdBy: req.user!._id
            }, session);

            if (!ledgerEntry) {
                throw new Error("Failed to update Finance Ledger. Transaction Rolled Back.");
            }
            // ---------------------------------------------------------
        }

        await createAuditLog(req, {
            action: "create",
            module: "student_record",
            targetId: studentRecord._id,
            description: `student record created (${studentRecord._id})`,
            status: "success"
        });

        await session.commitTransaction();
        session.endSession();


        // console.log("get the things first",)
        return res.status(200).json({
            ok: true,
            message: "Transaction Successful",
            data: {
                record: studentRecord,
                // receipt: receipt ? receipt[0] : null
                // receipt: "THIS_IS_FROM_NEW_CODE"
                receipt: receipt || null
            }
        });

    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Collection Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};



export const revertFeeTransaction = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { receiptId, status, remarks, penaltyAmount } = req.body;

        // 1. Validate Input
        if (!receiptId || !status) {
            throw new Error("Receipt ID and New Status are required");
        }

        const validStatuses = ["cancelled", "bounced"];
        if (!validStatuses.includes(status.toLowerCase())) {
            throw new Error("Invalid status. Allowed: cancelled, bounced");
        }




        // 2. Fetch Transaction
        const transaction: any = await FeeTransactionModel.findById(receiptId).session(session);
        if (!transaction) throw new Error("Transaction not found");

        // 3. Prevent Double Revert
        if (transaction.status === "cancelled" || transaction.status === "bounced") {
            throw new Error("Transaction is already reverted/cancelled.");
        }

        // *** NEW LOGIC STARTS HERE ***
        // If status is bounced, we store the penalty amount in the receipt
        if (status.toLowerCase() === "bounced") {
            if (penaltyAmount) {
                transaction.penaltyAmount = Number(penaltyAmount);
            }
            else {
                // Optional: Throw error if penalty is mandatory for bounced checks
                throw new Error("Penalty amount is required when status is bounced");
                // transaction.penaltyAmount = 0;
            }
        }
        // *** NEW LOGIC ENDS HERE ***

        // 4. Fetch Linked Student Ledger
        const studentRecord: any = await StudentRecordModel.findById(transaction.recordId).session(session);
        if (!studentRecord) throw new Error("Linked Student Record not found");

        // ======================================================
        // 5. REVERT LOGIC: SUBTRACT MONEY
        // ======================================================
        // We iterate over the 'allocation' array stored in the receipt
        // Example: [{ feeHead: "firstTermAmt", amount: 5000 }]

        transaction.allocation.forEach((item: any) => {
            const head = item.feeHead;
            const amount = Number(item.amount);

            // Safety check: Don't go below zero (though theoretically shouldn't happen)
            if (studentRecord.feePaid[head] >= amount) {
                studentRecord.feePaid[head] -= amount;
            } else {
                // Critical data integrity error
                throw new Error(`Data Integrity Error: Cannot revert ${amount} from ${head}. Only ${studentRecord.feePaid[head]} paid.`);
            }
        });

        // ======================================================
        // 6. RECALCULATE DUES
        // ======================================================
        const str = studentRecord.feeStructure;
        const pd = studentRecord.feePaid;

        const newDues = {
            admissionDues: str.admissionFee - pd.admissionFee,

            // Standard Academic Dues Sum
            // academicDues: (str.admissionFee + str.firstTermAmt + str.secondTermAmt) 
            //               - (pd.admissionFee + pd.firstTermAmt + pd.secondTermAmt),

            firstTermDues: str.firstTermAmt - pd.firstTermAmt,
            secondTermDues: str.secondTermAmt - pd.secondTermAmt,

            busfirstTermDues: str.busFirstTermAmt - pd.busFirstTermAmt,
            busSecondTermDues: str.busSecondTermAmt - pd.busSecondTermAmt
        };

        studentRecord.dues = newDues;
        studentRecord.isFullyPaid = false; // Obviously not fully paid if money was removed

        // 7. Update Transaction Status
        transaction.status = status.toLowerCase(); // "bounced" or "cancelled"



        let exitingRemarks = transaction?.remarks || ""

        if (remarks) {
            transaction.remarks = remarks + ` (Reverted on ${new Date().toISOString()})`;
        } else {
            transaction.remarks = exitingRemarks + ` (Reverted on ${new Date().toISOString()})`;
        }


        // ======================================================
        // 8. FINANCE LEDGER UPDATE (The New Part)
        // ======================================================
        // We find the ledger entry linked to this Receipt ID and mark it cancelled.
        // This removes it from Dashboard calculations immediately.
        const ledgerUpdate = await FinanceLedgerModel.findOneAndUpdate(
            { referenceId: receiptId }, // Find by Receipt ID
            {
                $set: {
                    status: status?.toLowerCase(),
                    cancellationReason: remarks || "Transaction Reverted",
                    cancelledBy: req?.user?._id || null,
                    // We don't change amount/date, so history is preserved
                }
            },
            { session, new: true }
        );

        // Optional: Warn if ledger entry wasn't found (Older data might not have ledger entries)
        if (!ledgerUpdate) {
            console.warn(`Warning: No Finance Ledger entry found for Receipt ID ${receiptId}`);
        }

        // 8. Save Both
        await studentRecord.save({ session });
        await transaction.save({ session });



        await createAuditLog(req, {
            action: "edit",
            module: "fee_receipt",
            targetId: receiptId,
            description: `fee receipt ${status} (${receiptId})`,
            status: "success"
        });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            ok: true,
            message: `Transaction marked as ${status}. Amount reverted successfully.`,
            data: {
                updatedRecord: studentRecord,
                updatedTransaction: transaction
            }
        });

    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Revert Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const applyConcession = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. EXTRACT & CONVERT FORM DATA
        const {
            schoolId,
            studentId,
            concessionType,
            remark,
            studentName,
            // Optional fields (for creation)
            classId, //needed if yure going to create the studnet newly for the first time
            sectionId,
            newOld,
            busPoint,

            // Convert Strings to correct types
            concessionValue: rawVal,
            isBusApplicable: rawBus
        } = req.body;

        const concessionValue = Number(rawVal);
        const isBusApplicable = (rawBus === 'true' || rawBus === true);
        const file = req.file;

        // 2. BASIC VALIDATION
        if (!schoolId || !studentId || !concessionType || !concessionValue) {
            throw new Error("Missing required fields");
        }


        if (!newOld) {
            return res.status(400).json({ ok: false, message: "newOld is required, it should be either new or old only " });
        }

        // 3. ROLE PROOF CHECK
        const userRole = req.user!.role.toLowerCase();
        const isExempt = ["correspondent", "principal"].includes(userRole);
        if (!isExempt && !file) {
            throw new Error("Proof document is mandatory for this user role.");
        }

        // 4. GET YEAR
        const schoolDoc = await SchoolModel.findById(schoolId).session(session);
        if (!schoolDoc) throw new Error("School not found");
        const currentYear = schoolDoc?.currentAcademicYear;

        // 5. CHECK EXISTING RECORD
        let studentRecord = await StudentRecordModel.findOne({
            schoolId,
            studentId,
            academicYear: currentYear
        }).session(session);

        if (studentRecord && studentRecord?.isActive === false) {
            throw new Error("Action Denied: This Student Record is INACTIVE. Cannot apply concession.");
        }

        // =========================================================
        // STRICT CONSTRAINT: BLOCK IF PAID > 0
        // =========================================================
        if (studentRecord) {
            const paid = studentRecord.feePaid;
            const totalPaidSoFar =
                paid.admissionFee +
                paid.firstTermAmt +
                paid.secondTermAmt +
                paid.busFirstTermAmt +
                paid.busSecondTermAmt;

            if (totalPaidSoFar > 0) {
                throw new Error(
                    `ACTION DENIED: This student has already paid ₹${totalPaidSoFar}. ` +
                    `Concessions can only be applied BEFORE any fee collection starts.`
                );
            }
        }

        // =========================================================
        // PREPARE CONTEXT (Class, Section)
        // =========================================================
        let targetClassId, targetSectionId, targetNewOld, targetClassName, targetSectionName;
        // IMPORTANT: Resolve Bus Status correctly
        let targetIsBus;

        if (studentRecord) {
            // Update Existing
            targetClassId = studentRecord.classId;
            targetSectionId = studentRecord?.sectionId || null;
            targetNewOld = studentRecord.newOld;

            // If rawBus is undefined, keep existing setting. Otherwise use new input.
            if (rawBus === undefined || rawBus === null) {
                targetIsBus = studentRecord.isBusApplicable;
            } else {
                targetIsBus = (rawBus === 'true' || rawBus === true);
            }


        } else {
            // Create New
            if (!classId || !newOld) throw new Error("Record doesn't exist. Provide classId and newOld.");
            targetClassId = classId;
            targetSectionId = sectionId || null;
            targetNewOld = newOld;
            targetIsBus = rawBus

            // Fetch Names
            const cDoc: any = await ClassModel.findById(classId).session(session);
            targetClassName = cDoc.name;
            targetSectionName = "N/A";
            if (targetSectionId) {
                const sDoc: any = await SectionModel.findById(targetSectionId).session(session);
                targetSectionName = sDoc.name;
            }
        }

        // 6. FETCH MASTER FEES (The Menu)
        const masterFee = await FeeStructureModel.findOne({
            schoolId, classId: targetClassId, type: newOld
        }).session(session);

        if (!masterFee) throw new Error("Master Fee Structure not found, please define the fee structrue for the selected class");


        // Upload Single File to S3

        let proofObj: any | null = null;
        if (file) {
            const uploadResult = await uploadFileToS3New(file);
            proofObj = {
                type: file.mimetype.startsWith("image") ? "image" : "pdf",
                key: uploadResult.key,
                url: uploadResult.url,
                originalName: file.originalname,
                uploadedAt: new Date()
            };
        } else if (studentRecord && studentRecord.concession?.proof) {
            // Keep existing proof if not uploading new one
            proofObj = studentRecord.concession.proof;
        }



        // console.log("uploadedFilesData", uploadedFilesData)

        // --- FIX STARTS HERE ---
        // Ensure we are working with plain numbers, not Mongoose wrappers
        const baseFees = masterFee.feeHead;


        // =========================================================
        // CALCULATION (Waterfall)
        // =========================================================
        let newStructure = {
            admissionFee: Number(baseFees.admissionFee),
            firstTermAmt: Number(baseFees.firstTermAmt),
            secondTermAmt: Number(baseFees.secondTermAmt),
            busFirstTermAmt: isBusApplicable ? Number(baseFees.busFirstTermAmt) : 0,
            busSecondTermAmt: isBusApplicable ? Number(baseFees.busSecondTermAmt) : 0,
        };

        // Calculate Discount
        let discountAmount = 0;
        let inAmount = 0
        if (concessionType?.toLowerCase()?.trim() === 'amount') {
            discountAmount = concessionValue;
            inAmount = concessionValue
        } else if (concessionType?.toLowerCase()?.trim() === 'percentage') {

            const tuition = !isBusApplicable ?
                newStructure.admissionFee + newStructure.firstTermAmt + newStructure.secondTermAmt :
                newStructure.admissionFee + newStructure.firstTermAmt + newStructure.secondTermAmt + newStructure.busFirstTermAmt + newStructure.busSecondTermAmt;
            discountAmount = (tuition * concessionValue) / 100;
            inAmount = discountAmount

        }

        const newDues = {
            admissionDues: 0,
            busfirstTermDues: 0,
            busSecondTermDues: 0,
            firstTermDues: 0,
            secondTermDues: 0
        };

        if (studentRecord) {
            studentRecord.feeStructure = newStructure;
            studentRecord.dues = newDues; // Safe because paid is 0
            studentRecord.isFullyPaid = false;
            studentRecord.isActive = true,

                studentRecord.concession = {
                    isApplied: true,
                    type: concessionType,
                    value: concessionValue,
                    inAmount: inAmount,
                    remark: remark,
                    proof: proofObj || null,
                    approvedBy: null
                };
            studentRecord.isBusApplicable = targetIsBus; // Ensure this is saved

            await studentRecord.save({ session });

            await StudentNewModel.findByIdAndUpdate(
                studentId,
                {
                    $set: {
                        currentClassId: targetClassId,
                        currentSectionId: targetSectionId,
                        isActive: true
                    }
                },
                { session: session }
            );
        } else {
            // Create New Record
            studentRecord = new StudentRecordModel({
                schoolId, studentId, academicYear: currentYear,
                classId: targetClassId, sectionId: targetSectionId,
                className: targetClassName, sectionName: targetSectionName,
                newOld: targetNewOld,
                isBusApplicable: targetIsBus, // Ensure this is saved
                isActive: true,
                studentName: studentName || null,

                feeStructure: newStructure,
                feePaid: { admissionFee: 0, firstTermAmt: 0, secondTermAmt: 0, busFirstTermAmt: 0, busSecondTermAmt: 0 },

                concession: {
                    isApplied: true,
                    type: concessionType,
                    value: concessionValue,
                    inAmount: inAmount,
                    remark: remark,
                    proof: proofObj || null,
                    approvedBy: null
                },
                dues: newDues,
                // isBusApplicable,
                busPoint: busPoint || null,
                isFullyPaid: false,
            });

            await studentRecord.save({ session })


            await StudentNewModel.findByIdAndUpdate(
                studentId,
                {
                    $set: {
                        currentClassId: targetClassId,
                        currentSectionId: targetSectionId,
                        isActive: true
                    }
                },
                { session: session }
            );
        }

        await createAuditLog(req, {
            action: "edit",
            module: "student_record",
            targetId: studentRecord._id,
            description: `concession applied for this student id (${studentRecord._id})`,
            status: "success"
        });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            ok: true,
            message: "Concession applied successfully",
            data: studentRecord,
        });

    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Concession Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const updateConcessionDetails = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            schoolId, studentRecordId,
            concessionType, concessionValue
        } = req.body;

        // 1. BASIC VALIDATION
        if (!schoolId || !studentRecordId || !concessionType || concessionValue === undefined) {
            throw new Error("Missing required fields (schoolId, studentRecordId, concessionType, concessionValue) ");
        }

        const value = Number(concessionValue);

        // 2. GET RECORD
        const schoolDoc = await SchoolModel.findById(schoolId).session(session);
        const currentYear = schoolDoc!.currentAcademicYear;

        let studentRecord = await StudentRecordModel.findOne({
            schoolId, _id: studentRecordId, academicYear: currentYear
        }).session(session);

        if (!studentRecord) {
            throw new Error("Student Record not found, first create the record");
        }

        // 3. CHECK PAID STATUS (Strict Mode)
        if (studentRecord) {
            const paid = studentRecord.feePaid;
            const totalPaid = paid.admissionFee + paid.firstTermAmt + paid.secondTermAmt + paid.busFirstTermAmt + paid.busSecondTermAmt;
            if (totalPaid > 0) throw new Error("Cannot update concession. Fees already paid.");
        }

        // 4. FETCH MASTER FEES (To reset calculation base)
        // If record doesn't exist, we need classId from body. If exists, take from record.
        // const targetClassId = studentRecord ? studentRecord.classId : classId;
        const targetIsBus = studentRecord?.isBusApplicable

        // const masterFee = await FeeStructureModel.findOne({ schoolId, classId: targetClassId }).session(session);
        // const baseFees = masterFee.feeHead;

        // 5. RE-CALCULATE STRUCTURE (Waterfall)
        let existingStructure = {
            admissionFee: Number(studentRecord.feeStructure.admissionFee || 0),
            firstTermAmt: Number(studentRecord.feeStructure.firstTermAmt || 0),
            secondTermAmt: Number(studentRecord.feeStructure.secondTermAmt || 0),
            busFirstTermAmt: targetIsBus ? Number(studentRecord.feeStructure.busFirstTermAmt) : 0,
            busSecondTermAmt: targetIsBus ? Number(studentRecord.feeStructure.busSecondTermAmt) : 0,
        };

        // Calc Discount
        let discountAmount = 0;
        let inAmount = 0;
        const typeKey = concessionType?.toLowerCase().trim();

        if (typeKey === 'amount') {
            discountAmount = value;
            inAmount = value;
        } else if (typeKey === 'percentage') {
            // (Tuition + Bus if needed) logic
            const baseTotal = !targetIsBus ?
                (existingStructure.admissionFee + existingStructure.firstTermAmt + existingStructure.secondTermAmt) :
                (existingStructure.admissionFee + existingStructure.firstTermAmt + existingStructure.secondTermAmt + existingStructure.busFirstTermAmt + existingStructure.busSecondTermAmt);

            discountAmount = (baseTotal * value) / 100;
            inAmount = discountAmount;
        }

        // 6. SAVE
        // We preserve the EXISTING PROOF if available
        const existingProof = studentRecord?.concession?.proof || null;

        const concessionObj = {
            isApplied: true,
            type: typeKey,
            value: value,
            inAmount: inAmount,
            remark: studentRecord?.concession.remark!,
            proof: existingProof, // Keep old proof
            approvedBy: null
        };

        if (studentRecord) {
            // studentRecord.feeStructure = newStructure;
            studentRecord.concession = concessionObj;
            await studentRecord.save({ session });
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ ok: true, message: "Concession details updated", data: studentRecord });

    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({ ok: false, message: error.message });
    }
};


// controllers/concessionController.js

export const uploadConcessionProof = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, studentRecordId } = req.body;
        const file = req.file;

        // console.log("gettin cale proof", schoolId, studentRecordId, file)

        if (!schoolId || !studentRecordId || !file) {
            return res.status(400).json({ ok: false, message: "Missing file or IDs (schoolId, studentRecordId)" });
        }

        // 1. Get Record
        const schoolDoc = await SchoolModel.findById(schoolId);

        const studentRecord = await StudentRecordModel.findOne({
            schoolId, _id: studentRecordId, academicYear: schoolDoc!.currentAcademicYear
        });

        if (!studentRecord) {
            return res.status(404).json({ ok: false, message: "Record not found" });
        }

        // 2. Upload
        const uploadResult = await uploadFileToS3New(file);
        const proofObj = {
            _id: new mongoose.Types.ObjectId(),
            type: file.mimetype.startsWith("image") ? "image" : "pdf",
            key: uploadResult.key,
            url: uploadResult.url,
            originalName: file.originalname,
            uploadedAt: new Date()
        };

        // 3. Update ONLY proof field
        // Ensure concession object exists
        if (!studentRecord.concession) (studentRecord.concession as any) = {};

        (studentRecord.concession.proof as any) = proofObj;

        await studentRecord.save();

        return res.status(200).json({ ok: true, message: "Proof uploaded", data: studentRecord });

    } catch (error: any) {
        console.error("Proof Upload Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};



export const getAllStudentRecords = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            // 1. Basics
            schoolId,
            page = 1,
            limit = 10,
            search,         // Matches Name OR RollNo

            // 2. Context Filters
            academicYear,   // "2025-2026"
            classId,
            sectionId,

            // 3. Status Filters
            newOld,         // "New" or "Old"
            isActive,       // true/false

            // 4. Financial/Feature Filters
            isBusApplicable, // true/false
            isFullyPaid,     // true/false
            hasConcession,   // true/false
            hasBusPoint      // true/false (Checks if busPoint is set)

        } = req.query;

        // --- VALIDATION ---
        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        // --- BASE QUERY ---
        let query: any = {
            schoolId: new mongoose.Types.ObjectId(schoolId)
        };

        // --- 1. SEARCH LOGIC (Name OR Roll Number) ---
        if (search) {
            // Create a case-insensitive Regex
            const searchRegex = new RegExp(search, "i");

            query.$or = [
                { studentName: searchRegex }, // Matches name
                { rollNumber: searchRegex }   // Matches roll number (e.g. "101")
            ];
        }

        // --- 2. CONTEXT FILTERS ---
        if (academicYear) {
            query.academicYear = academicYear;
        }
        if (classId) {
            query.classId = new mongoose.Types.ObjectId(classId);
        }
        if (sectionId) {
            query.sectionId = new mongoose.Types.ObjectId(sectionId);
        }

        // --- 3. STATUS FILTERS ---
        if (newOld) {
            query.newOld = newOld; // "New" or "Old"
        }

        // Handle Boolean strings coming from Query Params
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        // --- 4. FINANCIAL / FEATURE FILTERS ---
        if (isBusApplicable !== undefined) {
            query.isBusApplicable = isBusApplicable === 'true';
        }

        if (isFullyPaid !== undefined) {
            query.isFullyPaid = isFullyPaid === 'true';
        }

        if (hasConcession !== undefined) {
            const wantsConcession = hasConcession === 'true';
            // Check nested field concession.isApplied
            query["concession.isApplied"] = wantsConcession;
        }

        if (hasBusPoint !== undefined) {
            if (hasBusPoint === 'true') {
                query.busPoint = { $ne: null }; // Bus Point exists
            } else {
                query.busPoint = null; // Bus Point is empty
            }
        }

        // --- 5. PAGINATION SETUP ---
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // --- 6. EXECUTION ---
        const [records, total] = await Promise.all([
            StudentRecordModel.find(query)
                .sort({
                    classId: 1,      // Group by Class
                    sectionId: 1,    // Then by Section
                    studentName: 1   // Then Alphabetical
                })
                .skip(skip)
                .limit(limitNum)
                // Populate studentId to get the Image/Avatar which is in the main profile
                .populate("studentId", "studentImage studentName srId"),

            StudentRecordModel.countDocuments(query)
        ]);

        // --- 7. RESPONSE ---
        res.status(200).json({
            ok: true,
            data: records,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error: any) {
        console.error("Get All Student Records Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};


export const getStudentRecordById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, studentId } = req.params;

        if (!schoolId || !studentId) {
            return res.status(400).json({ ok: false, message: "schoolId and studentId are required" });
        }

        // 1. Determine Academic Year
        // If year provided, use it. If not, use School's Current Year.
        // let targetYear = null;



        const schoolDoc = await SchoolModel.findById(schoolId);
        if (!schoolDoc) return res.status(404).json({ ok: false, message: "School not found" });
        let targetYear = schoolDoc?.currentAcademicYear || null;

        // 2. Fetch The Ledger (Student Record)
        const studentRecord = await StudentRecordModel.findOne({
            schoolId,
            studentId,
            academicYear: targetYear
        })
            .populate("studentId", "studentName srId _id") // Profile Info
            .populate("classId", "name")   // Class Name
            .populate("sectionId", "name") // Section Name
            .populate("concession.approvedBy", "userName role"); // Who approved discount?

        if (!studentRecord) {
            return res.status(404).json({
                ok: false,
                message: `No record found for this student in Academic Year ${targetYear}`
            });
        }

        // 3. Fetch All Receipts (Transactions) linked to this Ledger
        const transactions = await FeeTransactionModel.find({
            recordId: studentRecord._id
        })
            .sort({ paymentDate: -1 }) // Latest first
            .populate("collectedBy", "userName"); // Who collected the money?

        // 4. Return Combined Data
        return res.status(200).json({
            ok: true,
            data: {
                ...studentRecord.toObject(),
                receipts: transactions // Attached array of receipts
            }
        });

    } catch (error: any) {
        console.error("Get Student Record Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};




export const deleteStudentRecord = async (req: RoleBasedRequest, res: Response) => {
    // // Start Transaction for safety
    // const session = await mongoose.startSession();
    // session.startTransaction();

    try {
        const { id } = req.params; // The StudentRecord ID (_id)

        if (!id) {
            return res.status(400).json({ ok: false, message: "Record ID is required" });
        }

        // 1. Find the Record
        // const record = await StudentRecordModel.findById(id).session(session);
        // if (!record) {
        //     return res.status(404).json({ ok: false, message: "Student Record not found" });
        // }

        // // 2. Delete All Linked Receipts (Transactions)
        // await FeeTransactionModel.deleteMany({ recordId: id }).session(session);

        // // 3. Delete the Record itself
        const studentRecord = await StudentRecordModel.findByIdAndDelete(id)
        // .session(session);

        if (!studentRecord) {
            return res.status(404).json({ ok: false, message: "Student Record not found" });
        }

        // // NOTE: We do NOT delete the Student Profile (StudentNewModel)
        // // because the student might have records in other years.

        // 2. CALL THE ARCHIVE UTILITY
        await archiveData({
            schoolId: studentRecord!.schoolId!,
            category: "student fee record",
            originalId: studentRecord._id,
            deletedData: studentRecord.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req.user!._id || null,
            reason: null, // Optional reason from body
        });

        await createAuditLog(req, {
            action: "delete",
            module: "student_record",
            targetId: studentRecord._id,
            description: `student record got deleted (${studentRecord._id})`,
            status: "success"
        });

        // await session.commitTransaction();
        // session.endSession();

        return res.status(200).json({
            ok: true,
            data: studentRecord,
            message: "Student Fee Record deleted successfully."
        });

    } catch (error: any) {
        // await session.abortTransaction();
        // session.endSession();
        console.error("Delete Record Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};



export const toggleStudentRecordStatus = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (isActive === undefined) {
            return res.status(400).json({ ok: false, message: "isActive boolean is required" });
        }

        const updatedRecord = await StudentRecordModel.findByIdAndUpdate(
            id,
            { $set: { isActive: isActive } },
            { new: true } // Return updated doc
        );

        if (!updatedRecord) {
            return res.status(404).json({ ok: false, message: "Student Record not found" });
        }

        await createAuditLog(req, {
            action: "edit",
            module: "student_record",
            targetId: updatedRecord._id,
            description: `student record active status got updated (${updatedRecord._id})`,
            status: "success"
        });

        return res.status(200).json({
            ok: true,
            message: `Student Record marked as ${isActive ? "Active" : "Inactive"}`,
            data: {
                _id: updatedRecord._id,
                isActive: updatedRecord.isActive
            }
        });

    } catch (error: any) {
        console.error("Toggle Status Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};
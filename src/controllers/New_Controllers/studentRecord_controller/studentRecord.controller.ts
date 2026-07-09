import mongoose, { Types } from "mongoose";
import StudentNewModel from "../../../models/New_Model/StudentModel/studentNew.model.js";
import StudentRecordModel from "../../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js";
import FeeTransactionModel from "../../../models/New_Model/FeeTransactionReceipt_model/feeTransactionReceipt.model.js";
import FeeStructureModel from "../../../models/New_Model/FeeStructureModel/FeeStructure.model.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
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
import FeeStructureConfigModel from "../../../models/New_Model/FeeStructureModel/feeStructureConfig.model.js";
import BillBookModel from "../../../models/New_Model/SchoolModel/billBook_model/BillBook.model.js";
import BillBookRecordModel from "../../../models/New_Model/SchoolModel/billBook_model/BillRecord.model.js";
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


// Helper: Increment alphanumeric string (e.g., "REC-001" -> "REC-002", "A-99" -> "A-100")
const getNextAlphanumericSequence = (currentSequence: string): string => {
    // Regex matches the prefix (anything) and the numbers at the very end
    const trimmedSeq = currentSequence.trim();

    const match = trimmedSeq.match(/(.*?)(\d+)$/);

    if (!match) {
        // If there are no numbers at the end (e.g., just "REC"), append "1"
        return `${trimmedSeq}1`;
    }

    const prefix = match[1];
    const numStr = String(match[2]);

    // Increment the number
    const nextNum = parseInt(numStr, 10) + 1;

    // Pad it back to the same length with leading zeros
    const paddedNum = String(nextNum).padStart(numStr.length, '0');

    return `${prefix}${paddedNum}`;
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

        // ── 10.5. PROCESS BILL BOOK SEQUENCE ─────────────────────────────
        let assignedBillNo = null;

        // Find the active bill book for this school & year
        const activeBillBook = await BillBookModel.findOne({
            schoolId,
            academicYear: currentYear,
            isActive: true
        }).session(session);

        if (activeBillBook && activeBillBook?.billNumber) {
            const lastTransaction = await FeeTransactionModel.findOne({
                schoolId,
                academicYear: currentYear,
                billNo: { $ne: null, $exists: true }
            })
                .sort({ createdAt: -1 })
                .session(session);

            // 2. Decide which number to use based on timestamps
            if (lastTransaction && lastTransaction.createdAt > activeBillBook.updatedAt) {
                // Scenario A: Normal sequence. The last transaction is newer than the bill book config.
                // We increment from the last transaction's bill number.
                assignedBillNo = getNextAlphanumericSequence(lastTransaction.billNo);
            } else {
                // Scenario B: First time use OR Staff manually edited the Bill Book config recently.
                // We use the exact static number they configured.
                assignedBillNo = activeBillBook.billNumber;
            }

            console.log("Assigned Bill Number for this receipt:", assignedBillNo);
        }

        // 9. GENERATE RECEIPT (If Paid > 0)
        let receipt = null;
        if (payingAmount > 0) {
            const receiptNo = await generateReceiptNo(schoolId, session);

            // Determine Status
            let status = "success";
            if (paymentMode.toLowerCase() === 'cheque') status = "pending";



            const uploadedProof = await processFiles(files);

            // --- CHANGED FROM .create() TO new Model() ---
            const newReceiptEntry = new FeeTransactionModel({
                schoolId,
                studentId,
                recordId: studentRecord._id,
                academicYear: currentYear,
                receiptNo,
                billNo: assignedBillNo, // 🌟 Inject the fetched bill number here
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

// NEW VERSION 

const TERM_KEYS = ["firstTerm", "secondTerm", "thirdTerm"] as const;
type TermKey = typeof TERM_KEYS[number];

/**
 * Computes feeStatus ("paid" | "unpaid" | null) using the head→term mapping
 * from FeeStructureConfig.feeHeads[].associatedTerm, checked against
 * School.academicTermDates[] term start dates and the student's duesv1 Map.
 */
export const computeFeeStatus = (
    feeHeadsConfig: { feeHead: string; associatedTerm: string | null; isTerm: boolean }[],
    duesMap: Map<string, number> | Record<string, number>,
    academicTermDates: any[], // schoolDoc.academicTermDates
    academicYear: string
): string | null => {
    const yearEntry = academicTermDates?.find((t: any) => t.academicYear === academicYear);
    if (!yearEntry) return null; // no term config for this year — can't evaluate

    const getDue = (head: string): number =>
        Number((duesMap as any).get?.(head) ?? (duesMap as any)[head] ?? 0);

    let anyTermActive = false;
    let anyActiveTermUnpaid = false;

    for (const termKey of TERM_KEYS) {
        const termStartDate = yearEntry[termKey];
        if (!termStartDate) continue; // this term isn't configured for the year

        const today = new Date();
        const isActive = new Date(termStartDate) <= today;
        if (!isActive) continue; // term hasn't started — skip

        anyTermActive = true;

        // heads belonging to this term (excluding non-term heads per your decision)
        const headsForThisTerm = feeHeadsConfig
            .filter((h) => h.isTerm && h.associatedTerm === termKey)
            .map((h) => h.feeHead);

        for (const head of headsForThisTerm) {
            if (getDue(head) > 0) {
                anyActiveTermUnpaid = true;
                break;
            }
        }

        if (anyActiveTermUnpaid) break;
    }

    if (!anyTermActive) return null; // no term has started yet — nothing to evaluate
    return anyActiveTermUnpaid ? "unpaid" : "paid";
};

export const collectFeeAndManageRecordV1 = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let {
            schoolId, studentId, studentName, classId, sectionId,
            amount, paymentMode, cashDenominations, referenceNumber,
            bankName, chequeDate, remarks,
            manualDueAllocation, paidHeads, newOld,
            academicYear,
            // isBusApplicable,
            busPoint,
        } = req.body;

        const files: any[] = req.files as any[];

        // ── Type coercions ──
        amount = Number(amount || 0);
        manualDueAllocation = manualDueAllocation === true || manualDueAllocation === "true";
        // isBusApplicable = isBusApplicable === true || isBusApplicable === "true";

        if (cashDenominations && typeof cashDenominations === "string") {
            cashDenominations = JSON.parse(cashDenominations);
        }
        if (paidHeads && typeof paidHeads === "string") {
            paidHeads = JSON.parse(paidHeads);
        }

        const payingAmount = Number(amount || 0);

        // ── 1. BASIC VALIDATION ──────────────────────────────────────────
        if (!schoolId || !studentId || !classId || !paymentMode) {
            throw new Error("Missing required fields: schoolId, studentId, classId, paymentMode");
        }
        if (!newOld) {
            return res.status(400).json({ ok: false, message: "newOld is required — must be 'new' or 'old'" });
        }

        if (!academicYear) {
            return res.status(400).json({
                ok: false,
                message: "academicYear is required",
            });
        }

        // ── 2. FETCH FEE CONFIG (source of truth for head names & order) ─
        const feeConfig = await FeeStructureConfigModel.findOne({ schoolId }).session(session);
        if (!feeConfig || !feeConfig.feeHeads || feeConfig.feeHeads.length === 0) {
            throw new Error("No FeeStructureConfig found. Please configure fee heads first.");
        }
        // const orderedHeads: string[] = feeConfig.feeHeads;
        const orderedHeads: string[] = feeConfig.feeHeads.map((headObj: any) => headObj?.feeHead);

        const feeHeadsConfigRaw = feeConfig?.feeHeads;




        let currentYear = academicYear
        // ── 3. GET ACADEMIC YEAR ─────────────────────────────────────────
        const schoolDoc = await SchoolModel.findById(schoolId).session(session);
        if (!schoolDoc) throw new Error("School not found");

        if (!academicYear) {
            currentYear = schoolDoc.currentAcademicYear;
        }

        // ── 4. CASH TALLY CHECK ──────────────────────────────────────────
        if (paymentMode.toLowerCase() === "cash") {
            if (!cashDenominations) throw new Error("Cash denominations required");
            const denoms = typeof cashDenominations === "string" ? JSON.parse(cashDenominations) : cashDenominations;
            const tallyTotal = denoms.reduce((sum: number, item: any) => sum + Number(item.label) * Number(item.count), 0);
            if (tallyTotal !== payingAmount) {
                throw new Error(`Cash Tally Mismatch. Entered: ${payingAmount}, Counted: ${tallyTotal}`);
            }
        }

        // ── 5. FIND OR INITIALIZE STUDENT RECORD ─────────────────────────
        let studentRecord: any = await StudentRecordModel.findOne({
            schoolId, studentId, academicYear: currentYear,
        }).session(session);

        // if (studentRecord && studentRecord?.isActive === false) {
        //     throw new Error("Action Denied: This Student Record is INACTIVE.");
        // }

        if (!studentRecord) {
            const cDoc: any = await ClassModel.findById(classId).session(session);
            let sName = "N/A";
            if (sectionId) {
                const sDoc: any = await SectionModel.findById(sectionId).session(session);
                sName = sDoc.name;
            }

            const masterFee = await FeeStructureModel.findOne({
                schoolId, classId, type: newOld,
            }).session(session);
            if (!masterFee) throw new Error("Fee Structure not found for this class");

            const savedMasterHeads = masterFee.feeHeads;

            // Build Maps for v1 schema
            const initialFeeStructures = new Map<string, number>();
            for (const head of orderedHeads) {
                let amt = Number(savedMasterHeads.get?.(head) ?? 0);
                // const isTransportHead = head.toLowerCase().includes("bus") || head.toLowerCase().includes("transport");
                // const isTransportHead = head.toLowerCase().includes("bus") || head.toLowerCase().includes("transport");

                // if (isTransportHead && !isBusApplicable) amt = 0;
                initialFeeStructures.set(head, amt);
            }

            const initialFeePaid = new Map<string, number>();
            const initialDues = new Map<string, number>();
            for (const head of orderedHeads) {
                initialFeePaid.set(head, 0);
                initialDues.set(head, initialFeeStructures.get(head) || 0);
            }

            studentRecord = new StudentRecordModel({
                schoolId, studentId, academicYear: currentYear,
                classId, sectionId: sectionId || null,
                studentName: studentName || null,
                className: cDoc.name, sectionName: sName,
                isActive: true,
                newOld: newOld?.toLowerCase() || "new",

                // 🌟 USING V1 PROPERTIES
                feeStructurev1: initialFeeStructures,
                feePaidv1: initialFeePaid,
                duesv1: initialDues,

                // concession: { isApplied: false },
                // isBusApplicable,
                busPoint,
            });
        }

        // ── 6. APPLY CONCESSION (Waterfall) ──────────────────────────────
        const currentPaidTotal: number = orderedHeads.reduce(
            // 🌟 Targeting feePaidv1
            (sum, head) => sum + Number(studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0),
            0
        );

        if (currentPaidTotal === 0 && studentRecord.concession && studentRecord.concession.isApplied) {
            let discount = Number(studentRecord.concession.inAmount || 0);

            if (discount > 0) {
                const reversedHeads = [...orderedHeads].reverse(); // Target later terms first

                for (const head of reversedHeads) {
                    if (discount <= 0) break;

                    // 🌟 Targeting feeStructurev1
                    const currentAmt = Number(
                        studentRecord.feeStructurev1.get?.(head) ?? studentRecord.feeStructurev1[head] ?? 0
                    );

                    if (currentAmt <= 0) continue;

                    if (currentAmt >= discount) {
                        setDynamicField(studentRecord.feeStructurev1, head, currentAmt - discount);
                        discount = 0;
                    } else {
                        discount -= currentAmt;
                        setDynamicField(studentRecord.feeStructurev1, head, 0);
                    }
                }
            }
        }

        // ── 7. OVERPAYMENT GUARD ─────────────────────────────────────────
        let totalStructure = 0;
        let totalPaid = 0;

        for (const head of orderedHeads) {
            // 🌟 Targeting v1 properties
            totalStructure += Number(studentRecord.feeStructurev1.get?.(head) ?? studentRecord.feeStructurev1[head] ?? 0);
            totalPaid += Number(studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0);
        }

        const totalPending = totalStructure - totalPaid;

        if (payingAmount > totalPending) {
            throw new Error(`Overpayment Rejected. Total Pending Dues: ${totalPending}, Entered Amount: ${payingAmount}`);
        }

        // ── 8. PAYMENT ALLOCATION (FIFO or Manual) ───────────────────────
        const receiptAllocationList: { feeHead: string; amount: number }[] = [];
        let remainingToPay = payingAmount;

        if (remainingToPay > 0) {
            if (manualDueAllocation === true) {
                // ── MANUAL MODE
                if (!paidHeads) throw new Error("paidHeads is required for Manual Allocation");
                const parsedHeads: Record<string, number> =
                    typeof paidHeads === "string" ? JSON.parse(paidHeads) : paidHeads;

                // Validate all submitted heads exist in config
                for (const head of Object.keys(parsedHeads)) {
                    if (!orderedHeads.includes(head)) {
                        throw new Error(
                            `Invalid fee head in paidHeads: '${head}'. Allowed heads: [${orderedHeads.join(", ")}]`
                        );
                    }
                }

                const manualSum = Object.values(parsedHeads).reduce((sum, v) => sum + Number(v), 0);
                if (manualSum !== payingAmount) throw new Error("Manual allocation sum does not match Amount");

                for (const [head, val] of Object.entries(parsedHeads)) {
                    const payVal = Number(val);
                    if (payVal <= 0) continue;

                    // 🌟 Targeting v1 properties
                    const headStructure = Number(studentRecord.feeStructurev1.get?.(head) ?? studentRecord.feeStructurev1[head] ?? 0);
                    const headPaid = Number(studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0);
                    const headDue = headStructure - headPaid;

                    if (payVal > headDue) {
                        throw new Error(`Overpayment on '${head}'. Due: ${headDue}, Paying: ${payVal}`);
                    }

                    setDynamicField(studentRecord.feePaidv1, head, headPaid + payVal);
                    receiptAllocationList.push({ feeHead: head, amount: payVal });
                }
            } else {
                // ── FIFO MODE
                for (const head of orderedHeads) {
                    if (remainingToPay <= 0) break;

                    // 🌟 Targeting v1 properties
                    const headStructure = Number(studentRecord.feeStructurev1.get?.(head) ?? studentRecord.feeStructurev1[head] ?? 0);
                    const headPaid = Number(studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0);
                    const due = headStructure - headPaid;

                    if (due > 0) {
                        const pay = Math.min(remainingToPay, due);
                        setDynamicField(studentRecord.feePaidv1, head, headPaid + pay);
                        receiptAllocationList.push({ feeHead: head, amount: pay });
                        remainingToPay -= pay;
                    }
                }

                if (remainingToPay > 0) {
                    throw new Error(`Overpayment! Excess Amount: ${remainingToPay}. All dues are cleared.`);
                }
            }
        }

        // ── 9. RECALCULATE DUES & STATUS ─────────────────────────────────
        let totalDuesRemaining = 0;

        for (const head of orderedHeads) {
            // 🌟 Targeting v1 properties
            const structure = Number(studentRecord.feeStructurev1.get?.(head) ?? studentRecord.feeStructurev1[head] ?? 0);
            const paid = Number(studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0);
            const due = structure - paid;

            setDynamicField(studentRecord.duesv1, head, due);
            totalDuesRemaining += due;
        }

        studentRecord.isFullyPaid = totalDuesRemaining <= 0;


        // 🌟 NEW — term-aware fee status
        studentRecord.feeStatus = computeFeeStatus(
            feeHeadsConfigRaw,
            studentRecord.duesv1,
            schoolDoc.academicTermDates,
            currentYear!
        );

        studentRecord.isActive = true

        // ── 10. SAVE STUDENT RECORD ──────────────────────────────────────
        await studentRecord.save({ session });

        await StudentNewModel.findByIdAndUpdate(
            studentId,
            { $set: { currentClassId: studentRecord.classId, currentSectionId: studentRecord.sectionId, isActive: true } },
            { session }
        );

        // ── 10.5. PROCESS BILL BOOK SEQUENCE ─────────────────────────────
        let assignedBillNo = null;

        // Find the active bill book for this school & year
        const activeBillBook = await BillBookModel.findOne({
            schoolId,
            // academicYear: currentYear,
            isActive: true
        }).session(session);

        // console.log("activeBill book", activeBillBook)

        if (activeBillBook && activeBillBook?.billNumber) {
            // const lastTransaction = await FeeTransactionModel.findOne({
            //     schoolId,
            //     academicYear: currentYear,
            //     billNo: { $ne: null, $exists: true }
            // })
            //     .sort({ createdAt: -1 })
            //     .session(session);

            // // 2. Decide which number to use based on timestamps
            // if (lastTransaction && lastTransaction.createdAt > activeBillBook.updatedAt) {
            //     // Scenario A: Normal sequence. The last transaction is newer than the bill book config.
            //     // We increment from the last transaction's bill number.
            //     assignedBillNo = getNextAlphanumericSequence(lastTransaction.billNo);
            // } else {
            //     // Scenario B: First time use OR Staff manually edited the Bill Book config recently.
            //     // We use the exact static number they configured.
            //     assignedBillNo = activeBillBook.billNumber;
            // }

            // console.log("Assigned Bill Number for this receipt:", assignedBillNo);

            // 🌟 FIX: Scope to THIS specific bill book via the ledger (BillBookRecordModel),
            // not just schoolId + academicYear. This ensures reactivating an older book
            // continues ITS sequence, not whichever book was used most recently.
            const lastRecord = await BillBookRecordModel.findOne({
                schoolId,
                billBookId: activeBillBook._id,
                billNumber: { $ne: null, $exists: true }
            })
                .sort({ createdAt: -1 })
                .session(session);

            // 🌟 FIX: No more timestamp comparison. Presence/absence of a prior
            // record for THIS book is the only thing that decides increment vs. seed.
            if (lastRecord) {
                // This book has generated bills before — continue its sequence.
                assignedBillNo = getNextAlphanumericSequence(lastRecord.billNumber);
            } else {
                // Brand new book, OR this book has never generated a bill yet —
                // use its configured starting number.
                assignedBillNo = activeBillBook.billNumber;
            }

            console.log("Assigned Bill Number for this receipt:", assignedBillNo);

        }


        // ── 11. GENERATE RECEIPT ─────────────────────────────────────────
        let receipt = null;
        if (payingAmount > 0) {
            const receiptNo = await generateReceiptNo(schoolId, session);
            const status = paymentMode.toLowerCase() === "cheque" ? "pending" : "success";
            const uploadedProof = await processFiles(files);

            const newReceiptEntry = new FeeTransactionModel({
                schoolId, studentId, recordId: studentRecord._id,
                academicYear: currentYear,
                receiptNo,
                billNo: assignedBillNo, // 🌟 Inject the fetched bill number here
                paymentDate: new Date(), paymentMode: paymentMode.toLowerCase(),
                amountPaid: payingAmount, allocation: receiptAllocationList, proofUpload: uploadedProof || [],
                cashDenominations: paymentMode.toLowerCase() === "cash"
                    ? (typeof cashDenominations === "string" ? JSON.parse(cashDenominations) : cashDenominations) : [],
                referenceNumber, bankName, chequeDate, collectedBy: req.user!._id, remarks, status,
            });

            receipt = await newReceiptEntry.save({ session });

            try {
                // 🌟 NEW: Save to your permanent Bill Book Record ledger 
                if (activeBillBook && assignedBillNo) {
                    await BillBookRecordModel.create([{
                        schoolId,
                        academicYear: currentYear,
                        billBookId: activeBillBook._id,
                        studentId,
                        feeReceiptId: receipt._id, // Linked directly to the transaction we just saved
                        billNumber: assignedBillNo
                    }], { session });

                    // 🌟 NEW: Increment the tracker in the main BillBookModel so the 'next' view is accurate
                    // activeBillBook.billNumber = getNextAlphanumericSequence(assignedBillNo);
                    // await activeBillBook.save({ session });
                }
            } catch (error) {
                // console.log("error", error);
                console.log(
                    "Bill Book Record Creation Failed:",
                    error
                );
            }

            // ── 12. FINANCE LEDGER ───────────────────────────────────────
            const ledgerEntry = await createLedgerEntry({
                schoolId, academicYear: currentYear!, transactionType: "CREDIT",
                amount: payingAmount, date: new Date(), referenceModel: "FeeTransactionModel",
                referenceId: receipt._id, studentRecordId: studentRecord._id,
                feeReceiptId: newReceiptEntry._id, category: "Student Fee",
                section: "student_record", paymentMode: paymentMode.toLowerCase(),
                description: remarks || `Fee Collection - Receipt #${receiptNo}`,
                createdBy: req.user!._id,
            }, session);

            if (!ledgerEntry) throw new Error("Failed to update Finance Ledger. Transaction Rolled Back.");
        }

        // ── 13. AUDIT LOG ────────────────────────────────────────────────
        await createAuditLog(req, {
            action: "create", module: "student_record", targetId: studentRecord._id,
            description: `Student fee collected — Record (${studentRecord._id})`, status: "success",
        });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            ok: true, message: "Transaction Successful",
            data: { record: studentRecord, receipt: receipt || null },
        });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Collection V1 Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Required to safely modify Mongoose Maps dynamically
// ─────────────────────────────────────────────────────────────────────────────
function setDynamicField(target: any, key: string, value: number): void {
    if (typeof target.set === "function") {
        target.set(key, value); // Standard Mongoose Map injection
    } else {
        target[key] = value; // Fallback for plain objects
    }
}


//  END OF NEW VERSION




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



// NEW VERSION


// ==========================================
// REVERT FEE TRANSACTION V1
//
// Key changes from V0:
//  - feePaidv1 / feeStructurev1 / duesv1 (Maps) used throughout
//  - Dues recalculation is dynamic over orderedHeads from config
//  - allocation[].feeHead still works as-is (shape unchanged)
//  - No isBusApplicable — config-driven
// ==========================================
export const revertFeeTransactionV1 = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { receiptId, status, remarks, penaltyAmount } = req.body;

        // ── 1. VALIDATE INPUT ────────────────────────────────────────────
        if (!receiptId || !status) {
            throw new Error("Receipt ID and New Status are required");
        }

        const validStatuses = ["cancelled", "bounced"];
        if (!validStatuses.includes(status.toLowerCase())) {
            throw new Error("Invalid status. Allowed: cancelled, bounced");
        }

        // ── 2. FETCH TRANSACTION ─────────────────────────────────────────
        const transaction: any = await FeeTransactionModel.findById(receiptId).session(session);
        if (!transaction) throw new Error("Transaction not found");

        // ── 3. PREVENT DOUBLE REVERT ─────────────────────────────────────
        if (transaction.status === "cancelled" || transaction.status === "bounced") {
            throw new Error("Transaction is already reverted/cancelled.");
        }

        // ── 4. BOUNCED — PENALTY REQUIRED ────────────────────────────────
        if (status.toLowerCase() === "bounced") {
            if (!penaltyAmount) {
                throw new Error("Penalty amount is required when status is bounced");
            }
            transaction.penaltyAmount = Number(penaltyAmount);
        }

        // ── 5. FETCH LINKED STUDENT RECORD ───────────────────────────────
        const studentRecord: any = await StudentRecordModel.findById(transaction.recordId).session(session);
        if (!studentRecord) throw new Error("Linked Student Record not found");

        // ── 6. FETCH FEE CONFIG (for orderedHeads) ───────────────────────
        const feeConfig = await FeeStructureConfigModel.findOne({
            schoolId: studentRecord.schoolId,
        }).session(session);

        if (!feeConfig || !feeConfig.feeHeads || feeConfig.feeHeads.length === 0) {
            throw new Error(
                "No FeeStructureConfig found for this school. Cannot recalculate dues."
            );
        }
        // const orderedHeads: string[] = feeConfig.feeHeads;
        const orderedHeads: string[] = feeConfig.feeHeads.map((headObj: any) => headObj?.feeHead);

        // 🌟 NEW — keep raw config for term-mapping in status calc
        const feeHeadsConfigRaw = feeConfig.feeHeads;

        // 🌟 NEW — fetch school for academicTermDates
        const schoolDoc: any = await SchoolModel.findById(studentRecord.schoolId).session(session);
        if (!schoolDoc) throw new Error("School not found");


        // ── 7. REVERT ALLOCATION — SUBTRACT FROM feePaidv1 ──────────────
        // allocation shape unchanged: [{ feeHead: string, amount: number }]
        for (const item of transaction.allocation) {
            const head = item.feeHead;
            const amount = Number(item.amount);

            const currentPaid = Number(
                studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0
            );

            if (currentPaid < amount) {
                throw new Error(
                    `Data Integrity Error: Cannot revert ₹${amount} from '${head}'. Only ₹${currentPaid} was paid.`
                );
            }

            // Safely set on Mongoose Map
            if (typeof studentRecord.feePaidv1.set === "function") {
                studentRecord.feePaidv1.set(head, currentPaid - amount);
            } else {
                studentRecord.feePaidv1[head] = currentPaid - amount;
            }
        }

        // ── 8. RECALCULATE DUES DYNAMICALLY ─────────────────────────────
        let totalDuesRemaining = 0;

        for (const head of orderedHeads) {
            const structure = Number(
                studentRecord.feeStructurev1.get?.(head) ?? studentRecord.feeStructurev1[head] ?? 0
            );
            const paid = Number(
                studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0
            );
            const due = structure - paid;

            if (typeof studentRecord.duesv1.set === "function") {
                studentRecord.duesv1.set(head, due);
            } else {
                studentRecord.duesv1[head] = due;
            }

            totalDuesRemaining += due;
        }

        studentRecord.isFullyPaid = totalDuesRemaining <= 0;

        // 🌟 NEW — recompute term-aware fee status after revert
        studentRecord.feeStatus = computeFeeStatus(
            feeHeadsConfigRaw,
            studentRecord.duesv1,
            schoolDoc.academicTermDates,
            studentRecord.academicYear
        );

        // ── 9. UPDATE TRANSACTION STATUS & REMARKS ───────────────────────
        transaction.status = status.toLowerCase();

        const existingRemarks = transaction.remarks || "";
        transaction.remarks = remarks
            ? `${remarks} (Reverted on ${new Date().toISOString()})`
            : `${existingRemarks} (Reverted on ${new Date().toISOString()})`;

        // ── 10. FINANCE LEDGER — MARK CANCELLED ─────────────────────────
        const ledgerUpdate = await FinanceLedgerModel.findOneAndUpdate(
            { referenceId: receiptId },
            {
                $set: {
                    status: status.toLowerCase(),
                    cancellationReason: remarks || "Transaction Reverted",
                    cancelledBy: req?.user?._id || null,
                },
            },
            { session, new: true }
        );

        if (!ledgerUpdate) {
            // Older records may not have a ledger entry — warn but don't block
            console.warn(`Warning: No Finance Ledger entry found for Receipt ID ${receiptId}`);
        }

        // ── 11. SAVE ─────────────────────────────────────────────────────
        await studentRecord.save({ session });
        await transaction.save({ session });

        // ── 12. AUDIT ────────────────────────────────────────────────────
        await createAuditLog(req, {
            action: "edit",
            module: "fee_receipt",
            targetId: receiptId,
            description: `Fee receipt ${status} (${receiptId})`,
            status: "success",
        });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            ok: true,
            message: `Transaction marked as ${status}. Amount reverted successfully.`,
            data: {
                updatedRecord: studentRecord,
                updatedTransaction: transaction,
            },
        });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Revert V1 Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};



// END OF NEW VERSION






// apply  concession wont reduce the feestructure amounts, it wil be handled by the colletfeeand amnage record thigns only 
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

        // if (studentRecord && studentRecord?.isActive === false) {
        //     throw new Error("Action Denied: This Student Record is INACTIVE. Cannot apply concession.");
        // }

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
            studentRecord.isActive = false,

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
                isActive: false,
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


// NEW VERSION


// ==========================================
// APPLY CONCESSION V1
//
// Key changes from V0:
//  - No isBusApplicable — school controls which heads exist via config
//  - feeHead on FeeStructureModel is now a Map — accessed via .get(head)
//  - feeStructurev1 / feePaidv1 / duesv1 on StudentRecord are Maps
//  - Concession waterfall is dynamic over orderedHeads (reversed = latest first)
//  - Percentage base = sum of ALL heads in master (no bus carve-out)
//  - paid > 0 guard uses feePaidv1
// ==========================================
export const applyConcessionV1 = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // ── 1. EXTRACT & CONVERT ─────────────────────────────────────────
        const {
            schoolId,
            studentId,
            concessionType,  // "amount" | "percentage"
            remark,
            studentName,
            // For first-time record creation
            classId,
            sectionId,
            newOld,
            busPoint,
            concessionValue: rawVal,
            academicYear,
        } = req.body;

        const concessionValue = Number(rawVal);
        const file = req.file;

        // ── 2. BASIC VALIDATION ──────────────────────────────────────────
        if (!schoolId || !studentId || !concessionType || !concessionValue) {
            throw new Error("Missing required fields: schoolId, studentId, concessionType, concessionValue");
        }
        if (!newOld) {
            return res.status(400).json({
                ok: false,
                message: "newOld is required — must be 'new' or 'old'",
            });
        }

        if (!academicYear) {
            return res.status(400).json({
                ok: false,
                message: "academicYear is required",
            });
        }

        // ── 3. ROLE PROOF CHECK ──────────────────────────────────────────
        const userRole = req.user!.role.toLowerCase();
        const isExempt = ["correspondent", "principal"].includes(userRole);
        if (!isExempt && !file) {
            throw new Error("Proof document is mandatory for this user role.");
        }

        // ── 4. FETCH FEE CONFIG (source of truth for head names & order) ─
        const feeConfig = await FeeStructureConfigModel.findOne({ schoolId }).session(session);
        if (!feeConfig || !feeConfig.feeHeads || feeConfig.feeHeads.length === 0) {
            throw new Error(
                "No FeeStructureConfig found for this school. Please configure fee heads first."
            );
        }
        // const orderedHeads: string[] = feeConfig.feeHeads;
        const orderedHeads: string[] = feeConfig?.feeHeads?.map((headObj: any) => headObj?.feeHead);


        // ── 5. GET ACADEMIC YEAR ─────────────────────────────────────────
        let currentYear = academicYear
        if (!academicYear) {
            const schoolDoc = await SchoolModel.findById(schoolId).session(session);
            if (!schoolDoc) throw new Error("School not found");
            currentYear = schoolDoc.currentAcademicYear;
        }

        // ── 6. FIND EXISTING RECORD ──────────────────────────────────────
        let studentRecord: any = await StudentRecordModel.findOne({
            schoolId,
            studentId,
            academicYear: currentYear,
        }).session(session);

        // if (studentRecord && studentRecord?.isActive === false) {
        //     throw new Error(
        //         "Action Denied: This Student Record is INACTIVE. Cannot apply concession."
        //     );
        // }

        // ── 7. BLOCK IF ALREADY PAID (feePaidv1) ────────────────────────
        if (studentRecord) {
            const totalPaidSoFar: number = orderedHeads.reduce((sum, head) => {
                return sum + Number(
                    studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0
                );
            }, 0);

            if (totalPaidSoFar > 0) {
                throw new Error(
                    `ACTION DENIED: This student has already paid ₹${totalPaidSoFar}. ` +
                    `Concessions can only be applied BEFORE any fee collection starts.`
                );
            }
        }

        // ── 8. RESOLVE CLASS / SECTION CONTEXT ──────────────────────────
        let targetClassId: any, targetSectionId: any, targetNewOld: any;
        let targetClassName: string | undefined, targetSectionName: string | undefined;

        if (studentRecord) {
            // Updating existing record
            targetClassId = studentRecord.classId;
            targetSectionId = studentRecord.sectionId || null;
            targetNewOld = studentRecord.newOld;
        } else {
            // Creating new record — classId & newOld required
            if (!classId || !newOld) {
                throw new Error("Record doesn't exist. Provide classId and newOld to create one.");
            }
            targetClassId = classId;
            targetSectionId = sectionId || null;
            targetNewOld = newOld;

            const cDoc: any = await ClassModel.findById(classId).session(session);
            targetClassName = cDoc.name;
            targetSectionName = "N/A";
            if (targetSectionId) {
                const sDoc: any = await SectionModel.findById(targetSectionId).session(session);
                targetSectionName = sDoc.name;
            }
        }

        // ── 9. FETCH MASTER FEE STRUCTURE ────────────────────────────────
        const masterFee = await FeeStructureModel.findOne({
            schoolId,
            classId: targetClassId,
            type: targetNewOld,
        }).session(session);

        if (!masterFee) {
            throw new Error(
                "Master Fee Structure not found. Please define the fee structure for the selected class."
            );
        }

        // masterFee.feeHead is a Map<string, number> (V1 model)
        const masterFeeMap = masterFee.feeHeads;

        // ── 10. BUILD BASE FEE STRUCTURE FROM MASTER ────────────────────
        // All heads from config, amounts from master map (0 if head not in master)
        const baseFeeStructure: Map<string, number> = new Map<string, number>();
        let totalBaseFee = 0;

        for (const head of orderedHeads) {
            const amt = Number(masterFeeMap.get?.(head) ?? (masterFeeMap as any)[head] ?? 0);
            baseFeeStructure.set(head, amt);
            totalBaseFee += amt;
        }

        // ── 11. CALCULATE DISCOUNT AMOUNT ────────────────────────────────
        let discountAmount = 0;
        let inAmount = 0;


        if (concessionType?.toLowerCase()?.trim() === "amount") {
            discountAmount = concessionValue;
            inAmount = concessionValue;
        } else if (concessionType?.toLowerCase()?.trim() === "percentage") {
            // Base = sum of ALL heads in master (no carve-outs — school controls heads via config)
            discountAmount = (totalBaseFee * concessionValue) / 100;
            inAmount = discountAmount;
        } else {
            throw new Error("concessionType must be 'amount' or 'percentage'");
        }

        if (discountAmount > totalBaseFee) {
            throw new Error(
                `Concession amount (₹${discountAmount}) exceeds total fee (₹${totalBaseFee}).`
            );
        }

        // // ── 12. APPLY WATERFALL REDUCTION ────────────────────────────────
        // // Reversed = latest head first (e.g., Term 2 before Term 1 before Admission)
        // // This mirrors old V0 behavior: secondTerm → firstTerm → admission
        // const reducedFeeStructure = new Map<string, number>(baseFeeStructure);
        // let remaining = discountAmount;

        // const reversedHeads = [...orderedHeads].reverse();

        // for (const head of reversedHeads) {
        //     if (remaining <= 0) break;

        //     const currentAmt = reducedFeeStructure.get(head) ?? 0;
        //     if (currentAmt <= 0) continue;

        //     if (currentAmt >= remaining) {
        //         reducedFeeStructure.set(head, currentAmt - remaining);
        //         remaining = 0;
        //     } else {
        //         remaining -= currentAmt;
        //         reducedFeeStructure.set(head, 0);
        //     }
        // }

        // // ── 13. BUILD INITIAL DUES (all = structure since paid = 0) ──────
        // const initialDues = new Map<string, number>();
        // for (const head of orderedHeads) {
        //     initialDues.set(head, reducedFeeStructure.get(head) ?? 0);
        // }

        // const initialFeePaid = new Map<string, number>();
        // for (const head of orderedHeads) {
        //     initialFeePaid.set(head, 0);
        // }

        // ── 14. UPLOAD PROOF ─────────────────────────────────────────────
        let proofObj: any | null = null;
        if (file) {
            const uploadResult = await uploadFileToS3New(file);
            proofObj = {
                type: file.mimetype.startsWith("image") ? "image" : "pdf",
                key: uploadResult.key,
                url: uploadResult.url,
                originalName: file.originalname,
                uploadedAt: new Date(),
            };
        } else if (studentRecord && studentRecord.concession?.proof) {
            proofObj = studentRecord.concession.proof;
        }

        const concessionPayload = {
            isApplied: true,
            type: concessionType,
            value: concessionValue,
            inAmount,
            remark,
            proof: proofObj || null,
            approvedBy: null,
        };

        // ── 15. SAVE ─────────────────────────────────────────────────────
        if (studentRecord) {
            // Update existing — overwrite v1 maps
            // studentRecord.feeStructurev1 = reducedFeeStructure;
            // studentRecord.feePaidv1      = initialFeePaid;   // reset to 0 (paid guard above confirms it is already 0)
            // studentRecord.duesv1         = initialDues;
            studentRecord.isFullyPaid = false;
            studentRecord.isActive = false;
            studentRecord.concession = concessionPayload;

            await studentRecord.save({ session });
        } else {
            // Create new record
            studentRecord = new StudentRecordModel({
                schoolId,
                studentId,
                academicYear: currentYear,
                classId: targetClassId,
                sectionId: targetSectionId,
                className: targetClassName,
                sectionName: targetSectionName,
                studentName: studentName || null,
                newOld: targetNewOld,
                isActive: false,
                isFullyPaid: false,
                busPoint: busPoint || null,

                // feeStructurev1: reducedFeeStructure,
                // feePaidv1:      initialFeePaid,
                // duesv1:         initialDues,

                concession: concessionPayload,
            });

            await studentRecord.save({ session });
        }

        // Update student's current class/section
        await StudentNewModel.findByIdAndUpdate(
            studentId,
            {
                $set: {
                    currentClassId: targetClassId,
                    currentSectionId: targetSectionId,
                    isActive: true,
                },
            },
            { session }
        );

        // ── 16. AUDIT ────────────────────────────────────────────────────
        await createAuditLog(req, {
            action: "edit",
            module: "student_record",
            targetId: studentRecord._id,
            description: `Concession applied for student record (${studentRecord._id})`,
            status: "success",
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
        console.error("Concession V1 Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};
// END OF NEW VERSION

export const updateConcessionDetails = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            schoolId, studentRecordId,
            concessionType, concessionValue, academicYear,
        } = req.body;

        // 1. BASIC VALIDATION
        if (!schoolId || !studentRecordId || !concessionType || concessionValue === undefined) {
            throw new Error("Missing required fields (schoolId, studentRecordId, concessionType, concessionValue) ");
        }

        if (!academicYear) {
            return res.status(400).json({
                ok: false,
                message: "academicYear is required",
            });
        }

        const value = Number(concessionValue);

        // 2. GET RECORD
        let currentYear = academicYear
        if (!academicYear) {


            const schoolDoc = await SchoolModel.findById(schoolId).session(session);
            currentYear = schoolDoc!.currentAcademicYear;
        }

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



// ṆEW VERSION


// ==========================================
// UPDATE CONCESSION DETAILS V1
//
// Key changes from V0:
//  - Uses feeHeads (Map) from FeeStructureModel (not static feeHead fields)
//  - feeStructurev1 / feePaidv1 / duesv1 (Maps) on StudentRecord
//  - Actually applies waterfall reduction to feeStructurev1 (V0 had this bug — it didn't)
//  - No isBusApplicable — config-driven heads
//  - Percentage base = sum of ALL master heads
// ==========================================
export const updateConcessionDetailsV1 = async (req: RoleBasedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { schoolId, studentRecordId, concessionType, concessionValue, academicYear } = req.body;

        // ── 1. BASIC VALIDATION ──────────────────────────────────────────
        if (!schoolId || !studentRecordId || !concessionType || concessionValue === undefined) {
            throw new Error(
                "Missing required fields: schoolId, studentRecordId, concessionType, concessionValue"
            );
        }

        if (!academicYear) {
            return res.status(400).json({
                ok: false,
                message: "academicYear is required",
            });
        }

        const value = Number(concessionValue);
        const typeKey = concessionType?.toLowerCase().trim() as "amount" | "percentage";

        if (!["amount", "percentage"].includes(typeKey)) {
            throw new Error("concessionType must be 'amount' or 'percentage'");
        }

        // ── 2. FETCH FEE CONFIG ──────────────────────────────────────────
        const feeConfig = await FeeStructureConfigModel.findOne({ schoolId }).session(session);
        if (!feeConfig || !feeConfig.feeHeads || feeConfig.feeHeads.length === 0) {
            throw new Error(
                "No FeeStructureConfig found for this school. Please configure fee heads first."
            );
        }
        // const orderedHeads: string[] = feeConfig.feeHeads;
        const orderedHeads: string[] = feeConfig?.feeHeads?.map((headObj: any) => headObj?.feeHead);

        // ── 3. GET ACADEMIC YEAR ─────────────────────────────────────────
        // const schoolDoc = await SchoolModel.findById(schoolId).session(session);
        // if (!schoolDoc) throw new Error("School not found");
        // const currentYear = schoolDoc.currentAcademicYear;

        let currentYear = academicYear
        if (!academicYear) {
            const schoolDoc = await SchoolModel.findById(schoolId).session(session);
            if (!schoolDoc) throw new Error("School not found");
            currentYear = schoolDoc!.currentAcademicYear;
        }

        // ── 4. FIND STUDENT RECORD ───────────────────────────────────────
        const studentRecord: any = await StudentRecordModel.findOne({
            schoolId,
            _id: studentRecordId,
            academicYear: currentYear,
        }).session(session);

        if (!studentRecord) {
            throw new Error("Student Record not found");
        }

        // ── 5. BLOCK IF ALREADY PAID ─────────────────────────────────────
        const totalPaidSoFar: number = orderedHeads.reduce((sum, head) => {
            return sum + Number(
                studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0
            );
        }, 0);

        if (totalPaidSoFar > 0) {
            throw new Error(
                `Cannot update concession. Student has already paid ₹${totalPaidSoFar}.`
            );
        }

        // ── 6. FETCH MASTER FEE (fresh base for recalculation) ───────────
        // Always recalculate from master — never from the already-reduced feeStructurev1
        // because that may already have a previous concession baked in
        const masterFee = await FeeStructureModel.findOne({
            schoolId,
            classId: studentRecord.classId,
            type: studentRecord.newOld,
        }).session(session);

        if (!masterFee) {
            throw new Error(
                "Master Fee Structure not found for this student's class. Cannot recalculate concession."
            );
        }

        // masterFee.feeHeads is the Map<string, number> (V1 model field)
        const masterFeeMap = masterFee.feeHeads;

        // ── 7. BUILD FRESH BASE FROM MASTER ─────────────────────────────
        const baseFeeStructure = new Map<string, number>();
        let totalBaseFee = 0;

        for (const head of orderedHeads) {
            const amt = Number(masterFeeMap.get?.(head) ?? (masterFeeMap as any)[head] ?? 0);
            baseFeeStructure.set(head, amt);
            totalBaseFee += amt;
        }

        // ── 8. CALCULATE NEW DISCOUNT ────────────────────────────────────
        let discountAmount = 0;
        let inAmount = 0;

        if (typeKey === "amount") {
            discountAmount = value;
            inAmount = value;
        } else {
            // Percentage of total master fee (all heads, no carve-outs)
            discountAmount = (totalBaseFee * value) / 100;
            inAmount = discountAmount;
        }

        if (discountAmount > totalBaseFee) {
            throw new Error(
                `Concession amount (₹${discountAmount}) exceeds total fee (₹${totalBaseFee}).`
            );
        }

        // // ── 9. APPLY WATERFALL REDUCTION (reversed = latest head first) ──
        // const reducedFeeStructure = new Map<string, number>(baseFeeStructure);
        // let remaining = discountAmount;

        // for (const head of [...orderedHeads].reverse()) {
        //     if (remaining <= 0) break;

        //     const currentAmt = reducedFeeStructure.get(head) ?? 0;
        //     if (currentAmt <= 0) continue;

        //     if (currentAmt >= remaining) {
        //         reducedFeeStructure.set(head, currentAmt - remaining);
        //         remaining = 0;
        //     } else {
        //         remaining -= currentAmt;
        //         reducedFeeStructure.set(head, 0);
        //     }
        // }

        // ── 10. REBUILD DUES (paid is 0, so dues = structure) ───────────
        // const updatedDues = new Map<string, number>();
        // for (const head of orderedHeads) {
        //     updatedDues.set(head, reducedFeeStructure.get(head) ?? 0);
        // }

        // // ── 11. SAVE ─────────────────────────────────────────────────────
        // studentRecord.feeStructurev1 = reducedFeeStructure;
        // studentRecord.duesv1 = updatedDues;
        // feePaidv1 untouched — already confirmed it's all zeros

        studentRecord.concession = {
            isApplied: true,
            type: typeKey,
            value: value,
            inAmount: inAmount,
            remark: studentRecord.concession?.remark ?? null,  // preserve existing remark
            proof: studentRecord.concession?.proof ?? null,  // preserve existing proof
            approvedBy: null,
        };

        studentRecord.isFullyPaid = false;

        await studentRecord.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            ok: true,
            message: "Concession details updated successfully",
            data: studentRecord,
        });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// END OF NEW VERSION

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

export const approveStudentRecordConcession = async (req: RoleBasedRequest, res: Response) => {
    try {
        // Assuming you pass the specific record ID in the URL params
        const { studentId } = req.params;
        const { academicYear } = req.query
        const approverId = req.user?._id; // Extracted from your auth middleware
        const approverRole = req.user!.role;

        if (!studentId || studentId === "null") {
            return res.status(400).json({ ok: false, message: "Record ID is required." });
        }

        if (!academicYear) {
            return res.status(400).json({ ok: false, message: "academicYear are required." });
        }

        const query = {
            studentId,
            academicYear
        }

        // 1. Fetch the Record
        const studentRecord = await StudentRecordModel.findOne(query);

        if (!studentRecord) {
            return res.status(404).json({ ok: false, message: "Student Record not found." });
        }

        // 2. VALIDATION: Is the record active?
        // if (studentRecord.isActive === false) {
        //     return res.status(400).json({
        //         ok: false,
        //         message: "Cannot approve concession: This student record is currently inactive."
        //     });
        // }

        // 3. VALIDATION: Does a concession actually exist to approve?
        if (!studentRecord.concession || !studentRecord.concession.isApplied || studentRecord.concession.inAmount <= 0) {
            return res.status(400).json({
                ok: false,
                message: "Cannot approve: There is no active concession amount applied to this record."
            });
        }

        // 4. VALIDATION: Is it already approved?
        if (studentRecord.concession.approvedBy) {
            return res.status(400).json({
                ok: false,
                message: "Action Denied: This concession has already been approved."
            });
        }

        // 5. Apply the Approval
        // (studentRecord.concession as any)?.approvedBy = approverId;

        if (studentRecord.concession) {
            studentRecord.concession.approvedBy = new Types.ObjectId(approverId);
        }

        // Save the updated record
        const updatedRecord = await studentRecord.save();

        // 6. Log the Audit Trail (Crucial for financial actions)
        await createAuditLog(req, {
            action: "edit",
            module: "student_record",
            targetId: updatedRecord._id,
            description: `Concession of ₹${updatedRecord.concession.inAmount} approved by ${approverRole} (${approverId})`,
            status: "success"
        });

        // 7. Send Success Response
        return res.status(200).json({
            ok: true,
            message: "Concession approved successfully.",
            data: {
                _id: updatedRecord._id,
                concession: updatedRecord.concession
            }
        });

    } catch (error: any) {
        console.error("Concession Approval Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
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
            phone,

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

        if (phone) {
            query.mandatory.mobileNumber = phone;
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

export const getAllStudentRecordsV1 = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            schoolId,
            page = 1,
            limit = 10,
            search,
            academicYear,   // e.g., "2025-2026"
            classId,
            sectionId,
            isActive,
            phone,
            feeStatus,
            // isBusApplicable,
            isFullyPaid,
            hasConcession,
            hasBusPoint
        } = req.query;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const targetYear = academicYear;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skipNum = (pageNum - 1) * limitNum;

        // ==========================================
        // STAGE 1: Early Match on StudentMain (Performance Optimization)
        // Filter the main students first to reduce the join workload
        // ==========================================
        const initialMatch: any = {
            schoolId: new mongoose.Types.ObjectId(schoolId as string)
        };

        if (search) {
            // Assuming the main student model has studentName and srId
            const searchRegex = new RegExp(search as string, "i");
            initialMatch.$or = [
                { studentName: searchRegex },
                { srId: searchRegex }
            ];
        }

        // ==========================================
        // STAGE 2: The Post-Lookup Filters
        // If the user filters by Class or Fees, we apply this AFTER the join
        // ==========================================
        const postLookupMatch: any = {};

        if (classId) postLookupMatch["recordData.classId"] = new mongoose.Types.ObjectId(classId as string);
        if (sectionId) postLookupMatch["recordData.sectionId"] = new mongoose.Types.ObjectId(sectionId as string);
        if (phone) postLookupMatch["recordData.mandatory.mobileNumber"] = phone;
        if (feeStatus) {
            if (feeStatus === "paid") {
                postLookupMatch["recordData.feeStatus"] = feeStatus;
            }
            else {
                // postLookupMatch["recordData.feeStatus"] = feeStatus;
                postLookupMatch["recordData.feeStatus"] = { $ne: "paid" };
            }

        }


        if (isActive !== undefined) postLookupMatch["recordData.isActive"] = isActive === 'true';
        // if (isBusApplicable !== undefined) postLookupMatch["recordData.isBusApplicable"] = isBusApplicable === 'true';
        if (isFullyPaid !== undefined) postLookupMatch["recordData.isFullyPaid"] = isFullyPaid === 'true';
        if (hasConcession !== undefined) postLookupMatch["recordData.concession.isApplied"] = hasConcession === 'true';
        if (hasBusPoint !== undefined) {
            if (hasBusPoint === 'true') postLookupMatch["recordData.busPoint"] = { $ne: null };
            else postLookupMatch["recordData.busPoint"] = null;
        }


        // ==========================================
        // STAGE 3: The Aggregation Pipeline (TypeScript Safe)
        // ==========================================
        const pipeline: mongoose.PipelineStage[] = [];

        // 1. Filter students right away
        pipeline.push({ $match: initialMatch });

        // 2. Targeted Left Join
        pipeline.push({
            $lookup: {
                from: "studentrecords", // **IMPORTANT: Verify this matches your MongoDB collection name (usually plural lowercase)**
                let: { student_id: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$studentId", "$$student_id"] },
                                    { $eq: ["$academicYear", targetYear] }
                                ]
                            }
                        }
                    }
                ],
                as: "recordData"
            }
        });

        // 3. Unwind (preserveNullAndEmptyArrays keeps students WITHOUT records)
        pipeline.push({
            $unwind: {
                path: "$recordData",
                preserveNullAndEmptyArrays: true
            }
        });

        // 4. Apply post-lookup filters safely
        if (Object.keys(postLookupMatch).length > 0) {
            pipeline.push({ $match: postLookupMatch });
        }

        // 5. Format the output
        pipeline.push({
            $project: {
                _id: 1, // StudentMain _id
                studentName: 1,
                srId: 1,
                studentImage: 1,

                recordId: "$recordData._id",
                academicYear: targetYear,
                className: "$recordData.className",
                sectionName: "$recordData.sectionName",
                isActive: { $ifNull: ["$recordData.isActive", false] },
                // isBusApplicable: { $ifNull: ["$recordData.isBusApplicable", false] },
                isFullyPaid: { $ifNull: ["$recordData.isFullyPaid", false] },
                hasConcession: { $ifNull: ["$recordData.concession.isApplied", false] },
                // 🌟 NEW: Extract feeStatus, default to "unpaid" if record is missing
                feeStatus: { $ifNull: ["$recordData.feeStatus", "unpaid"] }
            }
        });

        // 6. Pagination & Counting
        pipeline.push({
            $facet: {
                metadata: [{ $count: "total" }],
                data: [
                    { $sort: { studentName: 1 } },
                    { $skip: skipNum },
                    { $limit: limitNum }
                ]
            }
        });


        const result = await StudentNewModel.aggregate(pipeline); // **IMPORTANT: Execute on StudentMainModel**

        // Extract facet data
        const total = result[0].metadata[0]?.total || 0;
        const records = result[0].data;

        // --- RESPONSE ---
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


export const getStudentRecordByIdV1 = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, studentId } = req.params;
        const { academicYear } = req.query; // Allows overriding the year from the frontend

        if (!schoolId || !studentId) {
            return res.status(400).json({ ok: false, message: "schoolId and studentId are required" });
        }

        // 1. Fetch Main Student Identity (Always Required)
        // We populate class/section here so we have fallback names if the record doesn't exist
        const studentMain: any = await StudentNewModel.findOne({ _id: studentId, schoolId })
            .populate("currentClassId", "name")
            .populate("currentSectionId", "name");

        if (!studentMain) {
            return res.status(404).json({ ok: false, message: "Student not found in main registry" });
        }

        // 2. Determine Academic Year
        let targetYear = academicYear;
        if (!targetYear) {
            const schoolDoc = await SchoolModel.findById(schoolId);
            if (!schoolDoc) return res.status(404).json({ ok: false, message: "School not found" });
            targetYear = schoolDoc.currentAcademicYear;
        }

        if (!targetYear) {
            return res.status(400).json({ ok: false, message: "Academic Year is required" });
        }

        // 3. Try to Fetch The Ledger (Student Record)
        const studentRecord = await StudentRecordModel.findOne({
            schoolId,
            studentId,
            academicYear: targetYear
        })
            .populate("studentId", "studentName srId _id studentImage newOld currentClassId currentSectionId") // Profile Info
            .populate("classId", "name")   // Class Name
            .populate("sectionId", "name") // Section Name
            .populate("concession.approvedBy", "userName role");

        let responseData;

        // 4. Construct the Unified Response
        if (studentRecord) {
            // --- SCENARIO A: Record Exists ---
            // Fetch All Receipts (Transactions) linked to this Ledger

            console.log("if  condition ")

            const transactions = await FeeTransactionModel.find({
                recordId: studentRecord._id
            })
                .sort({ paymentDate: -1 }) // Latest first
                .populate("collectedBy", "userName");

            responseData = {
                // ...studentRecord.toObject(),
                ...studentRecord.toObject({ flattenMaps: true }),

                _id: studentRecord._id, // Important flag for frontend

                // Safety overrides just in case main model was updated
                studentImage: studentMain.studentImage || null,
                newOld: studentRecord.newOld || studentMain.newOld,

                receipts: transactions, // Attached array of receipts
                isRecordCreated: true
            };
        } else {


            console.log("else condition ")
            const feeConfig = await FeeStructureConfigModel.findOne({ schoolId })

            // // 2. Build the default fee map based on the dynamic feeHeads
            // // This creates an object like: { "Tuition Fee": 0, "Transport Fee": 0 }
            // const defaultFeeMap = feeConfig?.feeHeads?.reduce((acc: Record<string, number>, head: string) => {
            //     acc[head] = 0;
            //     return acc;
            // }, {}) || {}


            // 2. Build the default fee map based on the dynamic feeHeads
            // This creates an object like: { "Tuition Fee": 0, "Transport Fee": 0 }
            const defaultFeeMap = feeConfig?.feeHeads?.reduce((acc: Record<string, number>, headObj: any) => {
                // 🌟 Extract the string name from the object safely using optional chaining
                const headName = headObj?.feeHead;

                if (headName) {
                    acc[headName] = 0;
                }

                return acc;
            }, {}) || {};

            // --- SCENARIO B: NO Record (Virtual Ghost Record) ---
            responseData = {
                _id: null, // Crucial flag for frontend (means "Not Enrolled for this Year")
                academicYear: targetYear,

                schoolId: schoolId,
                studentId: studentMain._id,
                studentName: studentMain.studentName,
                srId: studentMain.srId,
                studentImage: studentMain.studentImage || null,
                newOld: studentMain.newOld || "old",

                // Use main profile class/section as fallback
                classId: studentMain.currentClassId?._id || null,
                sectionId: studentMain.currentSectionId?._id || null,
                className: studentMain.currentClassId?.name || null,
                sectionName: studentMain.currentSectionId?.name || null,

                // Default Financials (Zeros)
                feeStructure: { admissionFee: 0, firstTermAmt: 0, secondTermAmt: 0, busFirstTermAmt: 0, busSecondTermAmt: 0 },
                feePaid: { admissionFee: 0, firstTermAmt: 0, secondTermAmt: 0, busFirstTermAmt: 0, busSecondTermAmt: 0 },
                dues: { admissionDues: 0, firstTermDues: 0, secondTermDues: 0, busfirstTermDues: 0, busSecondTermDues: 0 },


                // 🌟 NEW DYNAMIC v1 FINANCIALS 🌟
                // We spread the default map into new objects to ensure they don't share the same memory reference
                feeStructurev1: { ...defaultFeeMap },
                feePaidv1: { ...defaultFeeMap },
                duesv1: { ...defaultFeeMap },
                feeStatus: "unpaid", // 🌟 Explicitly default to unpaid if no record exists

                concession: { isApplied: false, type: null, value: 0, inAmount: 0, proof: null },

                isActive: false, // Record is not active yet
                // isBusApplicable: false,
                isFullyPaid: false,
                busPoint: null,

                receipts: [], // Empty array, no transactions yet
                isRecordCreated: false

            };
        }

        // 5. Return Combined Data
        return res.status(200).json({
            ok: true,
            data: responseData
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


        if (!id || id === "null") {
            return res.status(400).json({ ok: false, message: "id is required, check whether this student record has cretead or not first" });
        }

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


export const toggleStudentRecordStatusV1 = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { studentId } = req.params;
        const { isActive, academicYear } = req.body;

        const schoolId = req.user?.schoolId

        // 1. Validate parameters
        if (!studentId || studentId === "null") {
            return res.status(400).json({
                ok: false,
                message: "studentId is required to update or initialize a student record."
            });
        }

        if (isActive === undefined) {
            return res.status(400).json({ ok: false, message: "isActive boolean is required" });
        }

        if (!academicYear) {
            return res.status(400).json({ ok: false, message: "academicYear is required to target or upsert the correct row" });
        }

        // 2. Query, Update, and Upsert if not found
        const updatedRecord = await StudentRecordModel.findOneAndUpdate(
            {
                schoolId: schoolId,
                studentId: studentId,
                academicYear: academicYear
            },
            {
                // Fields to update regardless of whether it's a new or existing document
                $set: { isActive: isActive },

                // Fields only applied when a brand-new document is being created (Inserted)
                $setOnInsert: {
                    studentId: studentId,
                    academicYear: academicYear,
                    // Add any other core defaults your student record requires on creation here
                    // feeStatus: "pending", 
                    // attendancePercentage: 0
                }
            },
            {
                upsert: true,             // 🌟 CRITICAL: Creates the document if it doesn't exist
                new: true,                // Returns the newly updated/inserted doc
                setDefaultsOnInsert: true // Applies any default values specified in your Mongoose Schema
            }
        );

        if (!updatedRecord) {
            return res.status(404).json({
                ok: false,
                message: `student not found`,
            });
        }



        // 3. Create security audit log tracking
        await createAuditLog(req, {
            action: updatedRecord.createdAt === updatedRecord.updatedAt ? "create" : "edit",
            module: "student_record",
            targetId: updatedRecord._id,
            description: `Student record status initialized or updated for academic year ${academicYear} (${studentId})`,
            status: "success"
        });

        return res.status(200).json({
            ok: true,
            message: `Status updated for Student Record successfully processed for year ${academicYear}`,
            data: {
                _id: updatedRecord._id,
                studentId: updatedRecord.studentId,
                academicYear: updatedRecord.academicYear,
                isActive: updatedRecord.isActive,
                updatedRecord: updatedRecord
            }
        });

    } catch (error: any) {
        console.error("Toggle Status Upsert V1 Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};




export const updateStudentRecordNewOldType = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { studentId, schoolId } = req.params;
        const { newOld, academicYear } = req.body;

        // const schoolId = req.user?.schoolId

        // 1. Validate parameters
        if (!studentId || studentId === "null") {
            return res.status(400).json({
                ok: false,
                message: "studentId is required to update or initialize a student record."
            });
        }

        // if (newOld !== "new" && newOld !== "old") {
        //     return res.status(400).json({ ok: false, message: "newOld property only allows either new or old value only" });
        // }


        if (!['new', 'old'].includes(newOld)) {
            return res.status(400).json({ ok: false, message: "newOld must be 'new' or 'old'" });
        }

        if (!academicYear) {
            return res.status(400).json({ ok: false, message: "academicYear is required to target or upsert the correct row" });
        }

        // 2. Query, Update, and Upsert if not found
        const updatedRecord = await StudentRecordModel.findOneAndUpdate(
            {
                schoolId: schoolId,
                studentId: studentId,
                academicYear: academicYear
            },
            {
                // Fields to update regardless of whether it's a new or existing document
                $set: { newOld: newOld },
            },
            {
                // upsert: true,             // 🌟 CRITICAL: Creates the document if it doesn't exist
                new: true,                // Returns the newly updated/inserted doc
                // setDefaultsOnInsert: true // Applies any default values specified in your Mongoose Schema
            }
        );




        if (!updatedRecord) {
            return res.status(404).json({
                ok: false,
                message: `student not found`,
            });
        }


        await StudentNewModel.findByIdAndUpdate(
            studentId,
            {
                // Fields to update regardless of whether it's a new or existing document
                $set: { newOld: newOld },
            },
            {
                // upsert: true,             // 🌟 CRITICAL: Creates the document if it doesn't exist
                new: true,                // Returns the newly updated/inserted doc
                // setDefaultsOnInsert: true // Applies any default values specified in your Mongoose Schema
            }
        );


        // 3. Create security audit log tracking
        await createAuditLog(req, {
            // action: updatedRecord.createdAt === updatedRecord.updatedAt ? "create" : "edit",
            action: "edit",
            module: "student_record",
            targetId: updatedRecord._id,
            description: `Student record updated to ${newOld} value for academic year ${academicYear} (${studentId})`,
            status: "success"
        });

        return res.status(200).json({
            ok: true,
            message: `Student Record successfully updated ${newOld} processed for year ${academicYear}`,
            data: {
                _id: updatedRecord._id,
                studentId: updatedRecord.studentId,
                academicYear: updatedRecord.academicYear,
                isActive: updatedRecord.isActive,
                updatedRecord: updatedRecord
            }
        });

    } catch (error: any) {
        console.error("student record new old type update V1 Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};



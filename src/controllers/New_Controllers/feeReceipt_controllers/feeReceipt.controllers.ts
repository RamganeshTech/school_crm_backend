// import { FeeTransactionModel } from "../models/FeeTransactionModel.js"; // Adjust path as needed
import mongoose from "mongoose";
import FeeTransactionModel from "../../../models/New_Model/FeeTransactionReceipt_model/feeTransactionReceipt.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";
import StudentRecordModel from "../../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js";
import { createLedgerEntry } from "../financeLedger_controller/financeLedger.controller.js";

// ======================================================
// 1. GET TRANSACTIONS (Filtered by StudentId OR RecordId)
// ======================================================
export const getAllFeeTransactions = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { studentId, studentRecordId } = req.query;
        const schoolId = req.user!.schoolId; // Assuming you have auth middleware

        // 1. Initialize Filter with School Security
        let filter:any = { schoolId: schoolId };

        // 2. Dynamic Filtering Logic
        if (studentRecordId) {
            // If Record ID is provided (Specific Academic Year Record)
            filter.recordId = studentRecordId;
        }
        else if (studentId) {
            // If only Student ID is provided (History across all years)
            filter.studentId = studentId;
        }
        else {
            // Optional: Prevent fetching ALL school transactions without a filter
            // remove this block if you want to allow fetching everything
            return res.status(400).json({
                ok: false,
                message: "Please provide either a studentId or a studentRecordId."
            });
        }

        // 3. Fetch Data
        const transactions = await FeeTransactionModel.find(filter)
            .populate("studentId", "studentName _id") // Fetch basic student details
            .populate("recordId", "studentId _id classId sectionId className sectionName academicYear") // Fetch Year/Class details
            .sort({ createdAt: -1 }); // Show latest transactions first

        return res.status(200).json({
            ok: true,
            message: "receipts fetched",
            count: transactions.length,
            data: transactions
        });

    } catch (error: any) {
        console.error("Get Fee Transactions Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// ======================================================
// 2. GET SINGLE TRANSACTION BY ID
// ======================================================
export const getFeeTransactionById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: "Invalid Transaction ID" });
        }

        const transaction = await FeeTransactionModel.findById(id)
            .populate("studentId", "studentName _id srId")
            .populate("recordId", "studentId _id classId sectionId className sectionName academicYear") // Fetch Year/Class details

        if (!transaction) {
            return res.status(404).json({ ok: false, message: "Transaction not found" });
        }

        // // Security Check: Ensure transaction belongs to user's school
        // if (transaction.schoolId.toString() !== req.user.schoolId.toString()) {
        //     return res.status(403).json({ ok: false, message: "Unauthorized access to this transaction" });
        // }

        return res.status(200).json({
            ok: true,
            data: transaction
        });

    } catch (error: any) {
        console.error("Get Transaction By ID Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};



export const updateChequeStatus = async (req: any, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; 
        const { status, remarks } = req.body; 

        // 🌟 Added 'cancelled' to the allowed statuses
        if (!status || !['success', 'bounced', 'cancelled'].includes(status.toLowerCase())) {
            throw new Error("Valid status is required ('success', 'bounced', or 'cancelled').");
        }

        const targetStatus = status.toLowerCase();

        // 1. Fetch the transaction
        const transaction = await FeeTransactionModel.findById(id).session(session);
        
        if (!transaction) {
            throw new Error("Fee transaction not found.");
        }

        if (transaction.paymentMode !== "cheque" && transaction.paymentMode !== "bank_transfer") {
            throw new Error("Only cheque or bank transfer payments can have their status updated manually.");
        }

        if (transaction.status === targetStatus) {
            throw new Error(`Transaction is already marked as ${targetStatus}.`);
        }

        // ---------------------------------------------------------
        // SCENARIO A: CHEQUE CLEARED (SUCCESS)
        // ---------------------------------------------------------
        if (targetStatus === 'success') {
            transaction.status = 'success';
            if (remarks) {
                transaction.remarks = transaction.remarks ? `${transaction.remarks} | Cleared: ${remarks}` : `Cleared: ${remarks}`;
            }
            await transaction.save({ session });
        }

        // ---------------------------------------------------------
        // SCENARIO B: CHEQUE BOUNCED OR CANCELLED (REVERSAL REQUIRED)
        // ---------------------------------------------------------
        if (targetStatus === 'bounced' || targetStatus === 'cancelled') {
            transaction.status = targetStatus;
            
            const actionLabel = targetStatus === 'bounced' ? 'Bounce Reason' : 'Cancellation Reason';
            
            if (remarks) {
                transaction.remarks = transaction.remarks ? `${transaction.remarks} | ${actionLabel}: ${remarks}` : `${actionLabel}: ${remarks}`;
            }
            await transaction.save({ session });

            // Fetch the student record to reverse the payment
            const studentRecord: any = await StudentRecordModel.findById(transaction.recordId).session(session);

            if (studentRecord) {
                // Loop through the exact allocation array from this specific receipt
                for (const alloc of transaction.allocation) {
                    const head = alloc.feeHead;
                    const reversedAmt = alloc.amount;

                    // 🌟 The TypeScript fix: Guard against null/undefined keys
                    if (!head) continue;

                    // 1. Subtract from feePaidv1
                    const currentPaid = Number(studentRecord.feePaidv1.get?.(head) ?? studentRecord.feePaidv1[head] ?? 0);
                    setDynamicField(studentRecord.feePaidv1, head, currentPaid - reversedAmt);

                    // 2. Add back to duesv1
                    const currentDue = Number(studentRecord.duesv1.get?.(head) ?? studentRecord.duesv1[head] ?? 0);
                    setDynamicField(studentRecord.duesv1, head, currentDue + reversedAmt);
                }

                // Since the payment failed/cancelled, they are no longer fully paid
                studentRecord.isFullyPaid = false;
                await studentRecord.save({ session });
            }

            // Reverse Finance Ledger (Create a DEBIT to reverse the earlier CREDIT)
            const ledgerActionDesc = targetStatus === 'bounced' ? 'Bounced Cheque' : 'Cancelled Payment';
            
            await createLedgerEntry({
                schoolId: transaction.schoolId,
                academicYear: transaction.academicYear!,
                transactionType: "DEBIT", // Money out / Reversal
                amount: transaction.amountPaid,
                date: new Date(),
                referenceModel: "FeeTransactionModel",
                referenceId: transaction._id,
                feeReceiptId: transaction._id,
                category: "Fee Payment Reversal",
                section: "student_record",
                paymentMode: transaction.paymentMode,
                description: `Reversal for ${ledgerActionDesc} #${transaction.referenceNumber || transaction.receiptNo}`,
                createdBy: req.user!._id,
            }, session);
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            ok: true,
            message: `Payment status updated to '${targetStatus}' successfully.`,
            data: transaction
        });

    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Update Payment Status Error:", error);
        return res.status(400).json({ ok: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Ensure this is in the file to handle Mongoose Map updates
// ─────────────────────────────────────────────────────────────────────────────
function setDynamicField(target: any, key: string, value: number): void {
    if (typeof target.set === "function") {
        target.set(key, value);
    } else {
        target[key] = value;
    }
}
// import { FeeTransactionModel } from "../models/FeeTransactionModel.js"; // Adjust path as needed
import mongoose from "mongoose";
import FeeTransactionModel from "../../../models/New_Model/FeeTransactionReceipt_model/feeTransactionReceipt.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";

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
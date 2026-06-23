
// ==========================================
// GET ALL BILL RECORDS (With Filters & Pagination)

import type { Response } from "express";
import type { RoleBasedRequest } from "../../../../utils/types.js";
import mongoose from "mongoose";
import BillBookRecordModel from "../../../../models/New_Model/SchoolModel/billBook_model/BillRecord.model.js";

// ==========================================
export const getBillRecords = async (req: RoleBasedRequest, res: Response) => {
    try {
        // 1. Extract query parameters
        const { 
            schoolId, 
            academicYear, 
            billBookId, 
            billNumber, 
            page = "1", 
            limit = "10" 
        } = req.query;

        if (!schoolId) {
            return res.status(400).json({ 
                ok: false, 
                message: "School ID is required to fetch bill records." 
            });
        }

        // 2. Build the dynamic filter object
        const filter: any = { schoolId: new mongoose.Types.ObjectId(schoolId as string) };

        if (academicYear) {
            filter.academicYear = academicYear;
        }

        if (billBookId) {
            filter.billBookId = new mongoose.Types.ObjectId(billBookId as string);
        }

        // Use regex for partial, case-insensitive search (e.g., searching "10" finds "BMB-101")
        if (billNumber) {
            filter.billNumber = { $regex: billNumber as string, $options: "i" };
        }

        // 3. Setup Pagination variables
        const pageNum = Math.max(1, parseInt(page as string, 10));
        const limitNum = Math.max(1, parseInt(limit as string, 10));
        const skip = (pageNum - 1) * limitNum;

        // 4. Execute the DB Queries in parallel (for performance)
        const [records, totalRecords] = await Promise.all([
            BillBookRecordModel.find(filter)
                .populate("studentId", "_id studentName currentClassId currentSectionId") // Populate student details
                .populate("billBookId", "_id bookName") // Populate bill book details
                .populate("feeReceiptId", "_id receiptNo paymentDate paymentMode amountPaid status") // Populate transaction details
                .sort({ createdAt: -1 }) // Newest first
                .skip(skip)
                .limit(limitNum)
                .lean(),
            BillBookRecordModel.countDocuments(filter)
        ]);

        // 5. Calculate total pages
        const totalPages = Math.ceil(totalRecords / limitNum);

        // 6. Send Response
        return res.status(200).json({
            ok: true,
            message: "Bill records fetched successfully",
            data: {
                records,
                pagination: {
                    totalRecords,
                    totalPages,
                    currentPage: pageNum,
                    limit: limitNum,
                    hasNextPage: pageNum < totalPages,
                    hasPrevPage: pageNum > 1
                }
            }
        });

    } catch (error: any) {
        console.error("Get Bill Records Error:", error);
        return res.status(500).json({ 
            ok: false, 
            message: "Internal server error while fetching bill records.", 
            error: error.message 
        });
    }
};
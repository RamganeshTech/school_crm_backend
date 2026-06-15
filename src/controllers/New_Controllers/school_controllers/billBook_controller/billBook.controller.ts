import { type Response } from 'express';
import mongoose from 'mongoose';
import SchoolModel from '../../../../models/New_Model/SchoolModel/shoolModel.model.js';
import BillBookModel from '../../../../models/New_Model/SchoolModel/BillBook.model.js';
// import BillBookModel from '../models/BillBookModel'; // Adjust path
// import SchoolModel from '../models/SchoolModel'; // Adjust path

// ==========================================
// 1. CREATE NEW BILL BOOK
// ==========================================
export const createBillBook = async (req: any, res: Response) => {
    try {
        const { schoolId, bookName, billNumber } = req.body;
        const userId = req.user._id; // Assuming user auth middleware

        if (!schoolId || !bookName || !billNumber) {
            return res.status(400).json({ ok: false, message: "School ID, Book Name and billNumber are required." });
        }

        // Get current academic year
        const school = await SchoolModel.findById(schoolId);
        if (!school) return res.status(404).json({ ok: false, message: "School not found." });
        const academicYear = school.currentAcademicYear;

        // Start a session to handle the toggle safely
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Deactivate all existing bill books for this school/year
            await BillBookModel.updateMany(
                { schoolId, academicYear },
                { $set: { isActive: false } },
                { session }
            );

            // Create the new active bill book
            const newBook = new BillBookModel({
                schoolId,
                academicYear,
                bookName,
                billNumber: billNumber,
                isActive: true, // Newly created book is active by default
                createdBy: userId
            });

            await newBook.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(201).json({
                ok: true,
                message: "New Bill Book created and activated successfully.",
                data: newBook
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }

    } catch (error: any) {
        console.error("Create Bill Book Error:", error);
        return res.status(500).json({ ok: false, message: error.message || "Failed to create Bill Book." });
    }
};

// ==========================================
// 2. GET ALL BILL BOOKS (For the Data Table)
// ==========================================
export const getAllBillBooks = async (req: any, res: Response) => {
    try {
        const { schoolId } = req.params;
        
        const school = await SchoolModel.findById(schoolId);
        if (!school) return res.status(404).json({ ok: false, message: "School not found." });

        const books = await BillBookModel.find({ schoolId, academicYear: school.currentAcademicYear })
            .sort({ createdAt: -1 }) // Newest first
            .populate('createdBy', 'userName'); // Optional: see who created it

        return res.status(200).json({
            ok: true,
            data: books
        });
    } catch (error: any) {
        console.error("Get Bill Books Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to fetch Bill Books." });
    }
};

// ==========================================
// 3. UPDATE BILL BOOK (Name & Active Status)
// ==========================================
export const updateBillBook = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const { bookName, isActive } = req.body;

        const bookToUpdate = await BillBookModel.findById(id);
        if (!bookToUpdate) return res.status(404).json({ ok: false, message: "Bill Book not found." });

        // Start session if we need to swap active statuses
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            if (isActive === true && bookToUpdate.isActive === false) {
                // If they are activating THIS book, deactivate all others first
                await BillBookModel.updateMany(
                    { schoolId: bookToUpdate.schoolId, academicYear: bookToUpdate.academicYear },
                    { $set: { isActive: false } },
                    { session }
                );
            } else if (isActive === false && bookToUpdate.isActive === true) {
                // Prevent deactivating the only active book without creating a new one
                const otherActiveCount = await BillBookModel.countDocuments({
                    schoolId: bookToUpdate.schoolId,
                    academicYear: bookToUpdate.academicYear,
                    isActive: true,
                    _id: { $ne: id }
                }).session(session);

                if (otherActiveCount === 0) {
                    throw new Error("You cannot deactivate the only active Bill Book. Please activate another one first.");
                }
            }

            if (bookName) bookToUpdate.bookName = bookName;
            if (typeof isActive === 'boolean') bookToUpdate.isActive = isActive;

            await bookToUpdate.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).json({
                ok: true,
                message: "Bill Book updated successfully.",
                data: bookToUpdate
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }

    } catch (error: any) {
        console.error("Update Bill Book Error:", error);
        return res.status(400).json({ ok: false, message: error.message });
    }
};

// ==========================================
// 4. EDIT BILL SEQUENCE NUMBER MANUALLY
// ==========================================
export const editBillNumber = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const { newBillNumber } = req.body;

        if (!newBillNumber) {
            return res.status(400).json({ ok: false, message: "bill number is required." });
        }

        const updatedBook = await BillBookModel.findByIdAndUpdate(
            id,
            { $set: { billNumber: newBillNumber } },
            { new: true }
        );

        if (!updatedBook) {
            return res.status(404).json({ ok: false, message: "Bill Book not found." });
        }

        return res.status(200).json({
            ok: true,
            message: `Bill number sequence successfully updated to ${newBillNumber}. The next receipt will use this number.`,
            data: updatedBook
        });

    } catch (error: any) {
        console.error("Edit Bill Number Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to update sequence number." });
    }
};
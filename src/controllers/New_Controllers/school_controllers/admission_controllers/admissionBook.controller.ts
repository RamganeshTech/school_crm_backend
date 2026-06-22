import { type Response } from 'express';
import mongoose from 'mongoose';
import SchoolModel from '../../../../models/New_Model/SchoolModel/schoolModel.model.js';
import AdmissionBookModel from '../../../../models/New_Model/SchoolModel/admission_model/admissionBook.model.js';
// import AdmissionBookModel from '../models/AdmissionBookModel'; // Adjust path
// import SchoolModel from '../models/SchoolModel'; // Adjust path

// ==========================================
// 1. CREATE NEW ADMISSION BOOK
// ==========================================
export const createAdmissionBook = async (req: any, res: Response) => {
    try {
        const { schoolId, bookName, startingFormNumber } = req.body;
        const userId = req.user._id; // Assuming user auth middleware

        if (!schoolId || !bookName || !startingFormNumber) {
            return res.status(400).json({ ok: false, message: "School ID, Book Name, and Starting Form Number are required." });
        }

        // Get current academic year
        const school = await SchoolModel.findById(schoolId);
        if (!school) return res.status(404).json({ ok: false, message: "School not found." });
        const academicYear = school.currentAcademicYear;

        // Start a session to handle the toggle safely
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Deactivate all existing admission books for this school/year
            await AdmissionBookModel.updateMany(
                { schoolId, academicYear },
                { $set: { isActive: false } },
                { session }
            );

            // Create the new active admission book
            const newBook = new AdmissionBookModel({
                schoolId,
                academicYear,
                bookName,
                formNumber: startingFormNumber.trim(), // Stored as a string (e.g., "ADM-001")
                isActive: true, // Newly created book is active by default
                createdBy: userId
            });

            await newBook.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(201).json({
                ok: true,
                message: "New Admission Book created and activated successfully.",
                data: newBook
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }

    } catch (error: any) {
        console.error("Create Admission Book Error:", error);
        return res.status(500).json({ ok: false, message: error.message || "Failed to create Admission Book." });
    }
};

// ==========================================
// 2. GET ALL ADMISSION BOOKS 
// ==========================================
export const getAllAdmissionBooks = async (req: any, res: Response) => {
    try {
        const { schoolId } = req.params;

        // const school = await SchoolModel.findById(schoolId);
        // if (!school) return res.status(404).json({ ok: false, message: "School not found." });

        const books = await AdmissionBookModel.find({ schoolId })
            .sort({ createdAt: -1 }) // Newest first
            .populate('createdBy', 'userName _id'); // Optional

        return res.status(200).json({
            ok: true,
            data: books
        });
    } catch (error: any) {
        console.error("Get Admission Books Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to fetch Admission Books." });
    }
};

// ==========================================
// 3. UPDATE ADMISSION BOOK (Name & Active Status)
// ==========================================
export const updateAdmissionBook = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const { bookName, isActive } = req.body;

        const bookToUpdate = await AdmissionBookModel.findById(id);
        if (!bookToUpdate) return res.status(404).json({ ok: false, message: "Admission Book not found." });

        // Start session if we need to swap active statuses
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            if (isActive === true && bookToUpdate.isActive === false) {
                // If they are activating THIS book, deactivate all others first
                await AdmissionBookModel.updateMany(
                    { schoolId: bookToUpdate.schoolId },
                    { $set: { isActive: false } },
                    { session }
                );
            } else if (isActive === false && bookToUpdate.isActive === true) {
                // Prevent deactivating the only active book without creating a new one
                const otherActiveCount = await AdmissionBookModel.countDocuments({
                    schoolId: bookToUpdate.schoolId,
                    academicYear: bookToUpdate.academicYear,
                    isActive: true,
                    _id: { $ne: id }
                }).session(session);

                if (otherActiveCount === 0) {
                    throw new Error("You cannot deactivate the only active Admission Book. Please activate another one first.");
                }
            }

            if (bookName) bookToUpdate.bookName = bookName;
            if (typeof isActive === 'boolean') bookToUpdate.isActive = isActive;

            await bookToUpdate.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).json({
                ok: true,
                message: "Admission Book updated successfully.",
                data: bookToUpdate
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }

    } catch (error: any) {
        console.error("Update Admission Book Error:", error);
        return res.status(400).json({ ok: false, message: error.message });
    }
};

// ==========================================
// 4. EDIT FORM SEQUENCE NUMBER MANUALLY
// ==========================================
export const editFormNumber = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const { newFormNumber } = req.body;

        if (!newFormNumber || newFormNumber.trim() === "") {
            return res.status(400).json({ ok: false, message: "A valid form number is required." });
        }

        const updatedBook = await AdmissionBookModel.findByIdAndUpdate(
            id,
            { $set: { formNumber: newFormNumber.trim() } },
            { new: true }
        );

        if (!updatedBook) {
            return res.status(404).json({ ok: false, message: "Admission Book not found." });
        }

        return res.status(200).json({
            ok: true,
            message: `Form number sequence successfully updated to ${newFormNumber}. The next admission will use this number.`,
            data: updatedBook
        });

    } catch (error: any) {
        console.error("Edit Form Number Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to update form sequence number." });
    }
};


// ==========================================
// 5. DELETE ADMISSION BOOK
// ==========================================
export const deleteAdmissionBook = async (req: any, res: Response) => {
    try {
        const { id } = req.params;

        const bookToDelete = await AdmissionBookModel.findById(id);
        if (!bookToDelete) {
            return res.status(404).json({ ok: false, message: "Admission Book not found." });
        }

        // Guardrail: Never allow deletion of an actively running sequence
        if (bookToDelete.isActive) {
            return res.status(400).json({
                ok: false,
                message: "Cannot delete an active Admission Book. Please deactivate it or activate another book first."
            });
        }

        await AdmissionBookModel.findByIdAndDelete(id);

        return res.status(200).json({
            ok: true,
            message: "Admission Book deleted successfully."
        });

    } catch (error: any) {
        console.error("Delete Admission Book Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to delete Admission Book." });
    }
};
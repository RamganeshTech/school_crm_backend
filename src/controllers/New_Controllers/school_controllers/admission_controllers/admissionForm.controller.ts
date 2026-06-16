import { type Response } from 'express';
import mongoose from 'mongoose';
import AdmissionBookModel from '../../../../models/New_Model/SchoolModel/admission_model/admissionBook.model.js';
import AdmissionFormModel from '../../../../models/New_Model/SchoolModel/admission_model/admissionForm.model.js';
import SchoolModel from '../../../../models/New_Model/SchoolModel/shoolModel.model.js';

// utils/sequenceUtils.ts

/**
 * Takes an alphanumeric string (e.g., "ADM-2026-001" or "abc99") 
 * and increments the numeric portion at the very end.
 */
export const getNextAlphanumericSequence = (currentSequence: string): string => {
    // 1. Remove accidental spaces at the very end
    const trimmedSeq = currentSequence.trim(); 
    
    // 2. Separate the string into [Prefix] and [Ending Numbers]
    const match = trimmedSeq.match(/(.*?)(\d+)$/);
    
    if (!match) {
        // If the string doesn't end with a number at all, append "1"
        return `${trimmedSeq}1`;
    }

    const prefix = match[1];
    const numStr = String(match[2]);
    
    // 3. Increment the number
    const nextNum = parseInt(numStr, 10) + 1;
    
    // 4. Keep the exact same number of leading zeros
    const paddedNum = String(nextNum).padStart(numStr.length, '0');
    
    return `${prefix}${paddedNum}`;
};


export const generateAdmissionLink = async (req: any, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { schoolId } = req.body;
        
        const school = await SchoolModel.findById(schoolId);
        if (!school) return res.status(404).json({ ok: false, message: "School not found." });
        const academicYear = school.currentAcademicYear;

        // ── PROCESS ADMISSION BOOK SEQUENCE ──
        // let assignedFormNo = "PENDING-000";
        
        const activeBook = await AdmissionBookModel.findOne({
            schoolId, academicYear, isActive: true
        }).session(session);

        if (!activeBook) {
            throw new Error("Admissions are currently closed. Please activate an Admission Book first.");
        }

       // 🌟 Fix: Directly grab the current number from the active book
        const assignedFormNo = activeBook.formNumber;

        // 🌟 Fix: Immediately calculate the NEXT sequence and update the book in the database
        activeBook.formNumber = getNextAlphanumericSequence(assignedFormNo);
        await activeBook.save({ session }); // The book now stores Adm-2026-002 for the next person!

        // ── 2. CREATE BLANK FORM ──
        const newAdmissionForm = new AdmissionFormModel({
            schoolId,
            academicYear,
            formNumber: assignedFormNo, // Uses the exact number we just grabbed (Adm-2026-001)
            isSubmitted: false, 
            status: 'Pending'
        });

        const savedForm = await newAdmissionForm.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
            ok: true,
            message: "Form generated successfully.",
            data: {
                id: savedForm._id, // 🌟 Sent back so frontend can construct: /apply/ID
                formNumber: savedForm.formNumber
            }
        });

    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Generate Link Error:", error);
        
        if (error.code === 11000) {
            return res.status(409).json({ ok: false, message: "Sequence collision. Please try generating again." });
        }
        return res.status(500).json({ ok: false, message: error.message || "Failed to generate admission link." });
    }
};

// ==========================================
// 2. PUBLIC: SUBMIT (UPDATE) ADMISSION FORM
// ==========================================
export const submitPublicAdmissionForm = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        
        // 🌟 1. Securely destructure ONLY the fields the parent is allowed to edit
        const {
            studentName, phone, dob, age, gender,
            motherTongue, religion, community, emisNumber,
            currentAddress, permanentAddress,
            fatherName, fatherEducation, fatherOccupation,
            motherName, motherEducation, motherOccupation,
            examinationPassed, admissionSoughtFor
        } = req.body;

        const existingForm = await AdmissionFormModel.findById(id);
        
        if (!existingForm) {
            return res.status(404).json({ ok: false, message: "Invalid or expired admission link." });
        }

        if (existingForm.isSubmitted) {
            return res.status(400).json({ ok: false, message: "This application has already been submitted." });
        }

        // 🌟 2. Explicitly map fields to the database document
        existingForm.studentName = studentName;
        existingForm.phone = phone;
        existingForm.dob = dob;
        existingForm.age = age;
        existingForm.gender = gender;
        existingForm.motherTongue = motherTongue;
        existingForm.religion = religion;
        existingForm.community = community;
        
        if (emisNumber !== undefined) {
            existingForm.emisNumber = emisNumber;
        }
        
        existingForm.currentAddress = currentAddress;
        existingForm.permanentAddress = permanentAddress;
        
        existingForm.fatherName = fatherName;
        existingForm.fatherEducation = fatherEducation;
        existingForm.fatherOccupation = fatherOccupation;
        existingForm.motherName = motherName;
        existingForm.motherEducation = motherEducation;
        existingForm.motherOccupation = motherOccupation;
        
        existingForm.examinationPassed = examinationPassed;
        existingForm.admissionSoughtFor = admissionSoughtFor;

        // 🌟 3. Override internal tracking data safely
        existingForm.isSubmitted = true; 
        existingForm.submittedAt = new Date();
        // Notice: `status` is deliberately ignored here so it remains 'Pending'

        const savedForm = await existingForm.save();

        return res.status(200).json({
            ok: true,
            message: "Admission form submitted successfully.",
            data: {
                id: savedForm._id,
                formNumber: savedForm.formNumber,
                studentName: savedForm.studentName
            }
        });

    } catch (error: any) {
        console.error("Public Submit Error:", error);
        return res.status(500).json({ ok: false, message: error.message || "Failed to submit application." });
    }
};

// ==========================================
// INTERNAL: GET ALL ADMISSION FORMS (PAGINATED & FILTERED)
// ==========================================
export const getAllAdmissionForms = async (req: any, res: Response) => {
    try {
        const { schoolId } = req.params;
        const { 
            academicYear, 
            status, 
            search, 
            startDate, 
            endDate, 
            page = 1, 
            limit = 10 
        } = req.query;

        // 1. Build the Base Query
        const query: any = { schoolId };

        // 2. Status Filter
        if (status && status !== 'All') {
            query.status = status;
        }

        // 3. Search Filter (Student Name, Parent Name, Mobile Number)
        if (search) {
            query.$or = [
                { studentName: { $regex: search, $options: 'i' } },
                { fatherName: { $regex: search, $options: 'i' } },
                { motherName: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // 4. Date Range Filter (createdAt)
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                // Start of the selected day
                query.createdAt.$gte = new Date(new Date(startDate as string).setHours(0, 0, 0, 0));
            }
            if (endDate) {
                // End of the selected day
                query.createdAt.$lte = new Date(new Date(endDate as string).setHours(23, 59, 59, 999));
            }
        }

        // 5. Pagination Math
        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        // 6. Execute Count and Fetch Concurrently using Promise.all
        const [totalForms, forms] = await Promise.all([
            AdmissionFormModel.countDocuments(query),
            AdmissionFormModel.find(query)
                .sort({ createdAt: -1 }) // Newest first
                .skip(skip)
                .limit(limitNumber)
        ]);

        return res.status(200).json({
            ok: true,
            data: {
                forms,
                totalForms,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalForms / limitNumber),
                hasNextPage: skip + forms.length < totalForms
            }
        });
    } catch (error: any) {
        console.error("Get All Admission Forms Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to fetch admission forms." });
    }
};

// ==========================================
// INTERNAL: GET SINGLE ADMISSION FORM
// ==========================================
export const getSingleAdmissionForm = async (req: any, res: Response) => {
    try {
        const { id } = req.params;

        const form = await AdmissionFormModel.findById(id);

        if (!form) {
            return res.status(404).json({ ok: false, message: "Admission form not found." });
        }

        return res.status(200).json({
            ok: true,
            data: form
        });
    } catch (error: any) {
        console.error("Get Single Admission Form Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to fetch the admission form." });
    }
};

// ==========================================
// INTERNAL: DELETE ADMISSION FORM
// ==========================================
export const deleteAdmissionForm = async (req: any, res: Response) => {
    try {
        const { id } = req.params;

        // Find the form first to ensure it exists before trying to delete
        const formToDelete = await AdmissionFormModel.findById(id);
        
        if (!formToDelete) {
            return res.status(404).json({ ok: false, message: "Admission form not found." });
        }

        await AdmissionFormModel.findByIdAndDelete(id);

        return res.status(200).json({
            ok: true,
            message: `Admission Form ${formToDelete.formNumber} deleted successfully.`
        });
    } catch (error: any) {
        console.error("Delete Admission Form Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to delete the admission form." });
    }
};


// ==========================================
// INTERNAL: SET / UPDATE ADMISSION FORM STATUS
// ==========================================
export const updateAdmissionFormStatus = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate the status input
        const validStatuses = ['Pending', 'Approved', 'Rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                ok: false, 
                message: "Invalid status. Must be 'Pending', 'Approved', or 'Rejected'." 
            });
        }

        // Find and update the form
        const updatedForm = await AdmissionFormModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true } // Returns the updated document
        );

        if (!updatedForm) {
            return res.status(404).json({ ok: false, message: "Admission form not found." });
        }

        return res.status(200).json({
            ok: true,
            message: `Admission Form ${updatedForm.formNumber} marked as ${status}.`,
            data: updatedForm
        });

    } catch (error: any) {
        console.error("Update Admission Form Status Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to update the admission form status." });
    }
};
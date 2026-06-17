import { type Response } from 'express';
import mongoose from 'mongoose';
import AdmissionBookModel from '../../../../models/New_Model/SchoolModel/admission_model/admissionBook.model.js';
import AdmissionFormModel from '../../../../models/New_Model/SchoolModel/admission_model/admissionForm.model.js';
import SchoolModel from '../../../../models/New_Model/SchoolModel/shoolModel.model.js';
import StudentNewModel from '../../../../models/New_Model/StudentModel/studentNew.model.js';

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
            studentName, mobileNumber, dob, age, gender,
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
        existingForm.mobileNumber = mobileNumber;
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
                { mobileNumber: { $regex: search, $options: 'i' } },
                { formNumber: { $regex: search, $options: 'i' } }
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
// INTERNAL: GET LIGHTWEIGHT FORMS FOR DROPDOWN
// ==========================================
export const getAdmissionFormsForDropdown = async (req: any, res: Response) => {
    try {
        const { schoolId, academicYear, search } = req.query;

        // 🌟 Crucial: Only fetch Approved forms that are NOT yet linked to a student
        const query: any = {
            schoolId,
            academicYear,
            // status: 'Approved',
            studentId: null
        };

        if (search) {
            query.$or = [
                { formNumber: { $regex: search, $options: 'i' } },
                { studentName: { $regex: search, $options: 'i' } },
                { mobileNumber: { $regex: search, $options: 'i' } }
            ];
        }


        const forms = await AdmissionFormModel.find(query)
            .select('_id formNumber studentName mobileNumber isSubmitted submittedAt') // 🌟 Minimal Payload
            .sort({ createdAt: -1 })
            .lean()


        // 🌟 Ensure default empty strings exist for missing fields
        const processedForms = forms.map(form => ({
            _id: form._id || null,
            studentName: form?.studentName || null,
            mobileNumber: form?.mobileNumber || null,
            studentId: form?.studentId || null,
            submittedAt: form?.submittedAt || null,
            isSubmitted: form.isSubmitted,
            status: form?.status || null,
            formNumber: form?.formNumber || null
        }));

        return res.status(200).json({
            ok: true,
            data: processedForms,
            message: "fetched admission forms for drop downs"
        });
    } catch (error: any) {
        console.error("Get Dropdown Forms Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to fetch forms for dropdown." });
    }
};

// ==========================================
// INTERNAL: GET SINGLE ADMISSION FORM
// ==========================================
export const getSingleAdmissionForm = async (req: any, res: Response) => {
    try {
        const { id, studentId } = req.query;

        let form = null;

        // 1. If an explicit Admission Form ID is provided
        if (id && id !== 'undefined' && id !== 'null') {
            form = await AdmissionFormModel.findById(id);
        }
        // 2. Fallback: If a Student ID is provided instead
        else if (studentId && studentId !== 'undefined' && studentId !== 'null') {
            form = await AdmissionFormModel.findOne({ studentId });
        }

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
// INTERNAL: UPDATE ADMISSION FORM DETAILS (ADMIN)
// ==========================================
export const updateAdmissionFormDetails = async (req: any, res: Response) => {
    try {
        const { id, studentId } = req.query;

        // 🌟 Securely destructure ONLY the fields admins are allowed to edit
        const {
            studentName, mobileNumber, dob, age, gender,
            motherTongue, religion, community, emisNumber,
            currentAddress, permanentAddress,
            fatherName, fatherEducation, fatherOccupation,
            motherName, motherEducation, motherOccupation,
            examinationPassed, admissionSoughtFor
        } = req.body;

        // Build the dynamic search query
        let query: any = {};
        if (id && id !== 'undefined' && id !== 'null') {
            query._id = id;
        } else if (studentId && studentId !== 'undefined' && studentId !== 'null') {
            query.studentId = studentId;
        } else {
            return res.status(400).json({ ok: false, message: "Provide either form ID or Student ID." });
        }

        const existingForm = await AdmissionFormModel.findOne(query);

        if (!existingForm) {
            return res.status(404).json({ ok: false, message: "Admission form not found." });
        }

        // Explicitly map fields to the database document
        existingForm.studentName = studentName;
        existingForm.mobileNumber = mobileNumber;
        existingForm.dob = dob;
        existingForm.age = age;
        existingForm.gender = gender;
        existingForm.motherTongue = motherTongue;
        existingForm.religion = religion;
        existingForm.community = community;

        if (emisNumber !== undefined) existingForm.emisNumber = emisNumber;

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

        const savedForm = await existingForm.save();

        return res.status(200).json({
            ok: true,
            message: "Admission details updated successfully.",
            data: savedForm
        });

    } catch (error: any) {
        console.error("Admin Update Form Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to update admission details." });
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
        // const { id } = req.params;
        const { id, studentId } = req.query; // 🌟 Now using query params
        const { status } = req.body;

        // Validate the status input
        const validStatuses = ['Pending', 'Approved', 'Rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                ok: false,
                message: "Invalid status. Must be 'Pending', 'Approved', or 'Rejected'."
            });
        }

        // Build the dynamic search query
        let query: any = {};
        if (id && id !== 'undefined' && id !== 'null') {
            query._id = id;
        } else if (studentId && studentId !== 'undefined' && studentId !== 'null') {
            query.studentId = studentId;
        } else {
            return res.status(400).json({ ok: false, message: "Provide either form ID or Student ID." });
        }


        // Find and update the form
        const updatedForm = await AdmissionFormModel.findByIdAndUpdate(
            query,
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


// ==========================================
// INTERNAL: LINK STUDENT TO ADMISSION FORM
// ==========================================
export const linkStudentToAdmissionForm = async (req: any, res: Response) => {
    try {
        const { id } = req.params; // The Admission Form ID
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({ ok: false, message: "Student ID is required to link the form." });
        }

        // 1. Find the admission form
        const formToUpdate = await AdmissionFormModel.findById(id);

        if (!formToUpdate) {
            return res.status(404).json({ ok: false, message: "Admission form not found." });
        }

        const studentToUpdate = await StudentNewModel.findById(studentId);
        if (!studentToUpdate) {
            return res.status(404).json({ ok: false, message: "Student not found." });
        }

        // Guardrail: Ensure the form is actually approved before linking an active student
        // if (formToUpdate.status !== 'Approved') {
        //     return res.status(400).json({ 
        //         ok: false, 
        //         message: "You can only link a student to an Approved application. Please approve this form first." 
        //     });
        // }

        // 2. Link the student ID
        formToUpdate.studentId = studentId;
        studentToUpdate.admissionRefId = formToUpdate._id;


        // Ensure nested objects exist to avoid undefined errors
        if (!studentToUpdate.mandatory) studentToUpdate.mandatory = {} as any;
        if (!studentToUpdate.nonMandatory) studentToUpdate.nonMandatory = {} as any;

        const isEmpty = (val: any) => val === null || val === undefined || val === "";


        const mand = studentToUpdate.mandatory;
        const nonMand = studentToUpdate.nonMandatory;

        // Map Basic Fields
        if (isEmpty(studentToUpdate.studentName)) studentToUpdate.studentName = formToUpdate.studentName;

        // Map Mandatory Fields
        if (isEmpty(mand.gender)) mand.gender = formToUpdate.gender;
        if (isEmpty(mand.dob)) mand.dob = formToUpdate.dob;
        if (isEmpty(mand.motherName)) mand.motherName = formToUpdate.motherName;
        if (isEmpty(mand.fatherName)) mand.fatherName = formToUpdate.fatherName;
        if (isEmpty(mand.mobileNumber)) mand.mobileNumber = formToUpdate.mobileNumber;
        if (isEmpty(mand.address)) mand.address = formToUpdate.currentAddress;
        if (isEmpty(mand.motherTongue)) mand.motherTongue = formToUpdate.motherTongue;
        
        // Map specific mapped fields (Form Terminology -> UDISE Terminology)
        // if (isEmpty(mand.educationNumber)) mand.educationNumber = formToUpdate.emisNumber; 
        if (isEmpty(mand.socialCategory)) mand.socialCategory = formToUpdate.community; 
        
        // Map Non-Mandatory Fields
        // if (isEmpty(nonMand.previousResult)) nonMand.previousResult = formToUpdate.examinationPassed;


        await formToUpdate.save();
        await studentToUpdate.save();

        return res.status(200).json({
            ok: true,
            message: "Student successfully linked to this admission application.",
            data: formToUpdate
        });

    } catch (error: any) {
        console.error("Link Student Error:", error);
        return res.status(500).json({ ok: false, message: "Failed to link student to the admission form." });
    }
};
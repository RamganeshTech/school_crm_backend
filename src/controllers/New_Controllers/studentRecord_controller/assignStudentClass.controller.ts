import mongoose from "mongoose";
import SchoolModel from "../../../models/New_Model/SchoolModel/shoolModel.model.js";
import StudentRecordModel from "../../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js";
import StudentNewModel from "../../../models/New_Model/StudentModel/studentNew.model.js";
import FeeStructureModel from "../../../models/New_Model/FeeStructureModel/FeeStructure.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";

export const assignStudentToClass = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, studentId, classId, sectionId, studentName,
            newOld, rollNumber, className, sectionName, isBusApplicable } = req.body;
        let { academicYear } = req.body;

        // 1. Validate Required Fields
        if (!schoolId || !studentId || !classId) {
            return res.status(400).json({ ok: false, message: "schoolId, studentId, and classId are required." });
        }

        if (!newOld) {
            return res.status(400).json({ ok: false, message: "newOld is required, it should be either new or old only " });
        }

        // 2. Determine Academic Year
        if (!academicYear) {
            const schoolDoc = await SchoolModel.findById(schoolId);
            academicYear = schoolDoc?.currentAcademicYear;

            if (!academicYear) {
                return res.status(400).json({
                    ok: false,
                    message: "Academic year missing. Please provide it or set the current academic year in School Settings."
                });
            }
        }

        // 3. Fetch Class & Section Details (To get the Names)
        // const classDoc = await ClassModel.findById(classId);
        // if (!classDoc) {
        //     return res.status(404).json({ ok: false, message: "Class not found" });
        // }

        // let sectionDoc = null;
        // if (sectionId) {
        //     sectionDoc = await SectionModel.findById(sectionId);
        //     if (!sectionDoc) {
        //         return res.status(404).json({ ok: false, message: "Section not found" });
        //     }
        // }

        // 4. Update or Create the Student Record (Upsert)
        // logic: One student record per academic year per school
        const filter = {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            studentId: new mongoose.Types.ObjectId(studentId),
            academicYear: academicYear.trim() // Trim to avoid "2025 " mismatches
        };


        // const updateData = {
        //     schoolId,
        //     studentId,
        //     academicYear,
        //     classId: classId || null,
        //     sectionId: sectionId || null,
        //     className: className,           // Store Snapshot Name
        //     sectionName: sectionName || "N/A", // Store Snapshot Name
        //     newOld: newOld || null,
        //     rollNumber: rollNumber || null,
        //     isActive: true
        // };

        // const studentRecord = await StudentRecordModel.findOneAndUpdate(
        //     filter,
        //     { $set: updateData },
        //     { new: true, upsert: true, setDefaultsOnInsert: true }
        // );



        // 3. FINANCIAL SAFETY LOCK (Prevent moving if fees are paid)
        const existingRecord = await StudentRecordModel.findOne(filter);

        if (existingRecord) {
            // Calculate total paid so far
            const paidObj = existingRecord.feePaid || {};
            const totalPaid = (paidObj.admissionFee || 0) + (paidObj.firstTermAmt || 0) +
                (paidObj.secondTermAmt || 0) + (paidObj.busFirstTermAmt || 0) +
                (paidObj.busSecondTermAmt || 0);

            // If money has been collected, and we are trying to CHANGE the Class or Section
            // const isClassChanging = existingRecord.classId?.toString() !== classId;
            const isClassChanging = existingRecord.classId && existingRecord.classId.toString() !== classId;

            // const isSectionChanging = (existingRecord.sectionId?.toString() || null) !== (sectionId || null);

            if (totalPaid > 0  && isClassChanging) {
                return res.status(400).json({
                    ok: false,
                    message: `Action Blocked: Student has already paid ₹${totalPaid}. You cannot change their Class or Section without reverting payments first.`
                });
            }
        }

        // 4. FETCH MASTER FEE STRUCTURE (The Menu)
        const masterFee = await FeeStructureModel.findOne({
            schoolId,
            classId: classId,
            type: newOld
        });

        if (!masterFee) {
            return res.status(404).json({
                ok: false,
                message: "Fee Structure not defined for this Class. Please define fees in 'Fee Management' first."
            });
        }

        // 5. FETCH NAMES (If not provided in body, fetch from DB to be safe)
        // (Assuming you might want to fetch ClassModel/SectionModel here to get names if className is missing)
        // ... omitted for brevity as per your previous request, but assumes className is valid ...

        // 6. CALCULATE NEW FINANCIALS
        const baseFees = masterFee.feeHead;

        // Ensure boolean check handles strings like "true"
        const applyBus = isBusApplicable === true || isBusApplicable === "true";

        const newFeeStructure = {
            admissionFee: Number(baseFees.admissionFee || 0),
            firstTermAmt: Number(baseFees.firstTermAmt || 0),
            secondTermAmt: Number(baseFees.secondTermAmt || 0),
            // Only add bus fee if applicable
            busFirstTermAmt: applyBus ? Number(baseFees.busFirstTermAmt || 0) : 0,
            busSecondTermAmt: applyBus ? Number(baseFees.busSecondTermAmt || 0) : 0,
        };

        // Since we blocked updates if paid > 0, we can safely set Dues = Structure
        const newDues = {
            admissionDues: 0,
            firstTermDues: 0,
            secondTermDues: 0,
            busfirstTermDues: 0,
            busSecondTermDues: 0,
        };

        const resetConcession = {
            isApplied: false,
            type: null,
            value: 0,
            inAmount: 0,
            remark: null,
            proof: null,
            approvedBy: null
        };

        // 7. PREPARE UPDATE DATA
        const updateData = {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            studentId: new mongoose.Types.ObjectId(studentId),
            academicYear,

            studentName,

            // Location
            classId: new mongoose.Types.ObjectId(classId),
            className: className,

            sectionId: sectionId ? new mongoose.Types.ObjectId(sectionId) : null,
            sectionName: sectionName || "N/A",

            // Meta
            newOld: newOld || "Old",
            rollNumber: rollNumber || null,
            isActive: true,

            // FINANCIALS (The Reset)
            isBusApplicable: applyBus,
            feeStructure: newFeeStructure,
            dues: newDues,
            concession: resetConcession,

            // Note: We DO NOT reset 'feePaid'. 
            // If it was 0, it stays 0. 
            // If > 0, we already blocked the request above.
            // But if we are just updating metadata (like roll no) without changing class, feePaid remains safe.
        };

        // 8. EXECUTE UPSERT
        const studentRecord = await StudentRecordModel.findOneAndUpdate(
            filter,
            { $set: updateData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );



        // 5. Update the Main Student Model (Current Status)
        // We sync the StudentNewModel to reflect where they are *right now*
        await StudentNewModel.findByIdAndUpdate(
            studentId,
            {
                $set: {
                    currentClassId: classId,
                    currentSectionId: sectionId || null,
                    // isActive: true // Optional: Mark active when assigned
                }
            }
        );

        await createAuditLog(req, {
            action: "edit",
            module: "student_record",
            targetId: studentId,
            description: `student assinging to class (${studentId})`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: "Student assigned to class successfully.",
            data: studentRecord
        });

    } catch (error: any) {
        console.error("Assign Student Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};




export const removeStudentFromClass = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, studentId } = req.body;
        let { academicYear } = req.body; // Optional: If not sent, we use current

        if (!schoolId || !studentId) {
            return res.status(400).json({ ok: false, message: "schoolId and studentId are required." });
        }



        // 1. Fetch School to get Current Academic Year
        const schoolDoc = await SchoolModel.findById(schoolId);
        if (!schoolDoc) {
            return res.status(404).json({ ok: false, message: "School not found" });
        }

        const currentSchoolYear = schoolDoc?.currentAcademicYear;

        // 2. Determine Target Year
        // If frontend didn't send a specific year, assume they mean the Current Year
        const targetYear = academicYear || currentSchoolYear;

        if (!targetYear) {
            return res.status(400).json({
                ok: false,
                message: "Academic Year could not be determined. Please provide it."
            });
        }


        // 2. FIND THE RECORD FIRST (Don't delete yet)
        const filter = {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            studentId: new mongoose.Types.ObjectId(studentId),
            academicYear: targetYear
        };

        const existingRecord = await StudentRecordModel.findOne(filter);

        if (!existingRecord) {
            return res.status(404).json({
                ok: false,
                message: `No class assignment found for this student in ${targetYear}`
            });
        }

        // 3. FINANCIAL SAFETY LOCK
        // Check if any fee has been paid
        const paid = existingRecord.feePaid || {};
        const totalPaid = (paid.admissionFee || 0) +
            (paid.firstTermAmt || 0) +
            (paid.secondTermAmt || 0) +
            (paid.busFirstTermAmt || 0) +
            (paid.busSecondTermAmt || 0);

        if (totalPaid > 0) {
            return res.status(400).json({
                ok: false,
                message: `Action Blocked: Student has already paid ₹${totalPaid} for this academic year. You cannot remove them directly. Please refund or adjust fees first.`
            });
        }

        // 3. REMOVE the specific Class Assignment Record
        // This removes the link between Student <-> Class for that year
        const deletedRecord = await StudentRecordModel.findByIdAndDelete(existingRecord._id);


        if (!deletedRecord) {
            return res.status(404).json({
                ok: false,
                message: `No class assignment found for this student in ${targetYear}`
            });
        }

        // 4. SYNC StudentNewModel (Conditionally)
        // We only reset the student's "Current Status" if we just deleted the record 
        // for the CURRENT Academic Year.
        if (targetYear === currentSchoolYear) {
            await StudentNewModel.findByIdAndUpdate(
                studentId,
                {
                    $set: {
                        currentClassId: null,   // Reset Class
                        currentSectionId: null, // Reset Section
                        // isActive: false      // Optional: Mark inactive until re-assigned?
                    }
                }
            );
        }

        await createAuditLog(req, {
            action: "edit",
            module: "student_record",
            targetId: studentId,
            description: `student removed from the class (${studentId})`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: "Student removed from class successfully.",
            data: {
                studentId,
                academicYear: targetYear,
                isProfileReset: targetYear === currentSchoolYear
            }
        });

    } catch (error: any) {
        console.error("Remove Student Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};
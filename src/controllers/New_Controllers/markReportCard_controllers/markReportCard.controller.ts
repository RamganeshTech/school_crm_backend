
import type { Response } from "express";
import type { RoleBasedRequest } from "../../../utils/types.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import MarkReportModel from "../../../models/New_Model/markReportCard_model/markReportCard.model.js";

// ==========================================
// 1. CREATE MARK REPORT
// ==========================================
export const createMarkReport = async (req: RoleBasedRequest, res: Response) => {
    try {
        let {
            schoolId,
            classId,
            sectionId,
            studentId,
            academicYear,
            subjects = [], // Array of subjects
            remarks,
            isAbsent
        } = req.body;

        const recordedBy = req.user?._id; // Assuming you have authentication middleware

        // Basic Validation
        if (!schoolId || !studentId) {
            return res.status(400).json({ ok: false, message: "schoolId, and studentId are required." });
        }

        // 1. Academic Year Fallback
        if (!academicYear) {
            const school = await SchoolModel.findById(schoolId).select("currentAcademicYear");
            academicYear = school?.currentAcademicYear;

            if (!academicYear) {
                return res.status(400).json({ ok: false, message: "Academic year not provided and not set in school settings." });
            }
        }

        // 2. Validate Subjects Array
        if (!Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({ ok: false, message: "At least one subject with marks must be provided." });
        }

        // 3. Create the Report
        const newReport = new MarkReportModel({
            schoolId,
            academicYear,
            classId,
            sectionId: sectionId || null,
            studentId,
            subjects, // Injects the whole array at once
            remarks: remarks || "",
            isAbsent: isAbsent || false,
            recordedBy
        });

        await newReport.save();

        res.status(201).json({
            ok: true,
            message: "Mark report created successfully.",
            data: newReport
        });

    } catch (error: any) {
        console.error("Error creating mark report:", error);
        res.status(500).json({ ok: false, message: "Server error. Please try again later.", error: error.message });
    }
};

// ==========================================
// 2. GET ALL MARK REPORTS (With Filters)
// ==========================================
export const getAllMarkReports = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            schoolId,
            academicYear,
            classId,
            sectionId,
            studentId
        } = req.query;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required to fetch reports." });
        }

        // Build dynamic query
        const query: any = { schoolId };

        if (academicYear) query.academicYear = academicYear;
        if (classId) query.classId = classId;
        if (sectionId) query.sectionId = sectionId;
        if (studentId) query.studentId = studentId;

        // Fetch reports and populate references so the frontend gets names instead of just IDs
        const reports = await MarkReportModel.find(query)
            .populate("studentId", "studentName srId studentImage")

            .populate("classId", "name")
            .populate("sectionId", "name classId")
            .sort({ createdAt: -1 });

        res.status(200).json({
            ok: true,
            message: "Mark reports retrieved successfully.",
            count: reports.length,
            data: reports
        });

    } catch (error: any) {
        console.error("Error fetching mark reports:", error);
        res.status(500).json({ ok: false, message: "Server error. Please try again later.", error: error.message });
    }
};

// ==========================================
// 3. UPDATE MARK REPORT
// ==========================================
export const updateMarkReport = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { reportId } = req.params;
        const {
            classId,
            sectionId,
            studentId,
            academicYear,
            subjects,
            remarks,
            isAbsent
        } = req.body;

        if (!reportId) {
            return res.status(400).json({ ok: false, message: "Report ID is required." });
        }

        // Build the update object dynamically
        const updateData: any = {};

        // Hierarchy and Tenancy updates (only if provided)
        if (classId !== undefined) updateData.classId = classId;
        if (sectionId !== undefined) updateData.sectionId = sectionId;
        if (studentId !== undefined) updateData.studentId = studentId;
        if (academicYear !== undefined) updateData.academicYear = academicYear;


        if (subjects && Array.isArray(subjects)) updateData.subjects = subjects; // This replaces the old array with the new one
        if (remarks !== undefined) updateData.remarks = remarks;
        if (isAbsent !== undefined) updateData.isAbsent = isAbsent;

        const updatedReport = await MarkReportModel.findByIdAndUpdate(
            reportId,
            { $set: updateData },
            { new: true, runValidators: true } // Return updated doc & run schema validations
        );

        if (!updatedReport) {
            return res.status(404).json({ ok: false, message: "Mark report not found." });
        }

        res.status(200).json({
            ok: true,
            message: "Mark report updated successfully.",
            data: updatedReport
        });

    } catch (error: any) {
        console.error("Error updating mark report:", error);
        res.status(500).json({ ok: false, message: "Server error. Please try again later.", error: error.message });
    }
};

// ==========================================
// 4. DELETE MARK REPORT
// ==========================================
export const deleteMarkReport = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { reportId } = req.params;

        if (!reportId) {
            return res.status(400).json({ ok: false, message: "Report ID is required." });
        }

        const deletedReport = await MarkReportModel.findByIdAndDelete(reportId);

        if (!deletedReport) {
            return res.status(404).json({ ok: false, message: "Mark report not found." });
        }

        res.status(200).json({
            ok: true,
            message: "Mark report deleted successfully."
        });

    } catch (error: any) {
        console.error("Error deleting mark report:", error);
        res.status(500).json({ ok: false, message: "Server error. Please try again later.", error: error.message });
    }
};


// ==========================================
// 5. GET SINGLE MARK REPORT BY ID
// ==========================================
export const getMarkReportById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { reportId } = req.params;

        if (!reportId) {
            return res.status(400).json({ ok: false, message: "Report ID is required." });
        }

        const report = await MarkReportModel.findById(reportId)
            .populate("studentId", "studentName srId studentImage")
            .populate("classId", "name")
            .populate("sectionId", "classId name")
            .populate("recordedBy", "userName role schoolId"); // Helpful to see which teacher entered it

        if (!report) {
            return res.status(404).json({ ok: false, message: "Mark report not found." });
        }

        res.status(200).json({
            ok: true,
            message: "Mark report retrieved successfully.",
            data: report
        });

    } catch (error: any) {
        console.error("Error fetching single mark report:", error);
        res.status(500).json({ ok: false, message: "Server error. Please try again later.", error: error.message });
    }
};
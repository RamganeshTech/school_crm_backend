// import { Response } from "express";
// import MarkReportConfigModel from "../models/MarkReportConfigModel.js"; // Adjust path
// import SchoolModel from "../models/SchoolModel.js"; // Adjust path
// import { RoleBasedRequest } from "../types/index.js"; // Adjust path based on your types

import type { Response } from "express";
import type { RoleBasedRequest } from "../../../utils/types.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import MarkReportConfigModel from "../../../models/New_Model/markReportCard_model/markReportConfig.model.js";

// ==========================================
// 1. CREATE CONFIGURATION TEMPLATE
// ==========================================
export const createMarkReportConfig = async (req: RoleBasedRequest, res: Response) => {
    try {
        let {
            schoolId,
            academicYear,
            classId,
            exams = [],
            subjects = []
        } = req.body;

        if (!schoolId || !classId) {
            return res.status(400).json({ ok: false, message: "schoolId and classId are required." });
        }

        // Fallback for Academic Year
        if (!academicYear) {
            const school = await SchoolModel.findById(schoolId).select("currentAcademicYear");
            academicYear = school?.currentAcademicYear;
            if (!academicYear) {
                return res.status(400).json({ ok: false, message: "Academic year not provided." });
            }
        }

        // CRITICAL: Check if a configuration already exists for this exact class and year
        const existingConfig = await MarkReportConfigModel.findOne({
            schoolId,
            academicYear,
            classId
        });

        if (existingConfig) {
            return res.status(409).json({
                ok: false,
                message: "A report configuration already exists for this class and academic year. Please update the existing one instead."
            });
        }

        const newConfig = new MarkReportConfigModel({
            schoolId,
            academicYear,
            classId,
            exams,
            subjects
        });

        await newConfig.save();

        res.status(201).json({
            ok: true,
            message: "Mark report configuration created successfully.",
            data: newConfig
        });

    } catch (error: any) {
        console.error("Create Config Error:", error);
        res.status(500).json({ ok: false, message: "Server error", error: error.message });
    }
};

// ==========================================
// 2. GET CONFIGURATION BY CLASS
// ==========================================
// Frontend uses this to know how to draw the table before entering marks
export const getMarkReportConfigByClass = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, classId, academicYear } = req.query;

        if (!schoolId || !classId || !academicYear) {
            return res.status(400).json({ ok: false, message: "schoolId, classId, and academicYear are required." });
        }

        const config = await MarkReportConfigModel.findOne({
            schoolId,
            classId,
            academicYear
        });

        if (!config) {
            return res.status(404).json({ ok: false, message: "Configuration not found for this class." });
        }

        res.status(200).json({
            ok: true,
            data: config
        });

    } catch (error: any) {
        console.error("Get Config Error:", error);
        res.status(500).json({ ok: false, message: "Server error", error: error.message });
    }
};

// ==========================================
// 3. UPDATE CONFIGURATION TEMPLATE
// ==========================================
// Used when the school adds a new Exam or Subject in the middle of the year
export const updateMarkReportConfig = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { configId } = req.params;
        const { exams, subjects } = req.body;

        if (!configId) {
            return res.status(400).json({ ok: false, message: "Configuration ID is required." });
        }

        const updateData: any = {};
        if (exams && Array.isArray(exams)) updateData.exams = exams;
        if (subjects && Array.isArray(subjects)) updateData.subjects = subjects;

        const updatedConfig = await MarkReportConfigModel.findByIdAndUpdate(
            configId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedConfig) {
            return res.status(404).json({ ok: false, message: "Configuration not found." });
        }

        res.status(200).json({
            ok: true,
            message: "Configuration updated successfully.",
            data: updatedConfig
        });

    } catch (error: any) {
        console.error("Update Config Error:", error);
        res.status(500).json({ ok: false, message: "Server error", error: error.message });
    }
};
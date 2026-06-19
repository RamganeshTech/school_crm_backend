// ==========================================
// GET SCHOOL SETUP STATUS — Fee Collection Readiness Check
// No new models. Pure read/aggregation across existing collections.

import type { Request, Response } from "express";
import mongoose from "mongoose";
import ClassModel from "../../../models/New_Model/SchoolModel/classModel.model.js";
import SectionModel from "../../../models/New_Model/SchoolModel/section.model.js";
import FeeStructureConfigModel from "../../../models/New_Model/FeeStructureModel/feeStructureConfig.model.js";
import FeeStructureModel from "../../../models/New_Model/FeeStructureModel/FeeStructure.model.js";
import StudentRecordModel from "../../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js";

// ==========================================
export const getSchoolSetupStatus = async (req: Request, res: Response) => {
    try {
        const { schoolId } = req.query;

        if (!schoolId) {
            return res.status(400).json({ 
                ok: false, 
                message: "schoolId is required." 
            });
        }

        const schoolObjId = new mongoose.Types.ObjectId(schoolId as string);

        // ── 1. Fetch all classes for this school ──
        const classes = await ClassModel.find({ schoolId: schoolObjId }).lean();

        if (classes.length === 0) {
            return res.status(200).json({
                ok: true,
                data: {
                    overallPercentage: 0,
                    isFullySetup: false,
                    schoolLevel: {
                        feeConfigExists: false,
                        feeHeadsCount: 0
                    },
                    classes: [],
                    message: "No classes created yet. Start by adding classes."
                }
            });
        }

        const classIds = classes.map(c => c._id);

        // ── 2. Fetch sections for all classes in one query ──
        const sections = await SectionModel.find({ 
            classId: { $in: classIds } 
        }).lean();

        // ── 3. Fetch school-level fee config (feeHeads vocabulary) ──
        const feeConfig = await FeeStructureConfigModel.findOne({ 
            schoolId: schoolObjId 
        }).lean();

        const schoolFeeHeadsList = feeConfig?.feeHeads || [];
        const feeConfigExists = !!feeConfig && schoolFeeHeadsList.length > 0;

        // ── 4. Fetch fee structures for all classes in one query ──
        const feeStructures = await FeeStructureModel.find({ 
            classId: { $in: classIds } 
        }).lean();

        // Map for quick lookup: classId -> feeStructure doc
        const feeStructureMap = new Map<string, any>();
        for (const fs of feeStructures) {
            feeStructureMap.set(fs.classId.toString(), fs);
        }

        // // ── 5. Fetch student counts per class (to flag empty classes) ──
        // const studentCounts = await StudentRecordModel.aggregate([
        //     { $match: { schoolId: schoolObjId, isActive: true } },
        //     { $group: { _id: "$classId", count: { $sum: 1 } } }
        // ]);
        // const studentCountMap = new Map<string, number>();
        // for (const sc of studentCounts) {
        //     studentCountMap.set(sc._id?.toString(), sc.count);
        // }

        // ── 6. Build per-class readiness report ──
        const classReports = classes.map(cls => {
            const classIdStr = cls._id.toString();

            // --- Section check ---
            const classSections = sections.filter(
                s => s.classId.toString() === classIdStr
            );
            const sectionsConfigured = cls.hasSections 
                ? classSections.length > 0 
                : true; // no sections needed if hasSections is false

            // --- Teacher assignment check ---
            let teacherAssigned = false;
            if (cls.hasSections) {
                // at least one section should have a teacher
                teacherAssigned = classSections.some(
                    s => Array.isArray(s.classTeacherId) && s.classTeacherId.length > 0
                );
            } else {
                teacherAssigned = Array.isArray(cls.classTeacherId) && cls.classTeacherId.length > 0;
            }

            // --- Fee structure check ---
            const feeStructure = feeStructureMap.get(classIdStr);
            const feeHeadsMap = feeStructure?.feeHeads || {};
            const feeHeadsConfiguredCount = Object.keys(feeHeadsMap).length;
            const feeStructureExists = !!feeStructure;
            const feeStructureConfigured = feeStructureExists && feeHeadsConfiguredCount > 0;

            // Cross-check: does this class's feeHeads match school's feeHeads vocabulary?
            const missingFeeHeads = schoolFeeHeadsList.filter(
                (head: string) => !(head in feeHeadsMap)
            );

            // --- Student count (informational, not blocking) ---
            // const studentCount = studentCountMap.get(classIdStr) || 0;

            // --- Compute this class's readiness ---
            const checks = [sectionsConfigured, feeStructureConfigured];
            const passedChecks = checks.filter(Boolean).length;
            const classPercentage = Math.round((passedChecks / checks.length) * 100);

            const missingSteps: string[] = [];
            if (!sectionsConfigured) missingSteps.push("Sections not created");
            if (!feeStructureExists) missingSteps.push("Fee structure not set");
            else if (!feeStructureConfigured) missingSteps.push("Fee structure exists but has no fee heads configured");
            else if (missingFeeHeads.length > 0) missingSteps.push(`Missing fee heads: ${missingFeeHeads.join(", ")}`);
            if (!teacherAssigned) missingSteps.push("No class teacher assigned");
            // if (studentCount === 0) missingSteps.push("No students enrolled yet");

            return {
                classId: cls._id,
                className: cls.name,
                hasSections: cls.hasSections,
                sectionsConfigured,
                sectionsCount: classSections.length,
                teacherAssigned,
                feeStructureExists,
                feeStructureConfigured,
                feeHeadsConfiguredCount,
                missingFeeHeads,
                // studentCount,
                classPercentage, // based on blocking checks only
                status: classPercentage === 100 ? "ready" : classPercentage === 0 ? "not_configured" : "partial",
                missingSteps
            };
        });

        // ── 7. Compute overall percentage across all classes ──
        const totalPercentageSum = classReports.reduce((sum, c) => sum + c.classPercentage, 0);
        const overallPercentage = Math.round(totalPercentageSum / classReports.length);

        const isFullySetup = feeConfigExists && classReports.every(c => c.classPercentage === 100);

        return res.status(200).json({
            ok: true,
            data: {
                overallPercentage,
                isFullySetup,
                schoolLevel: {
                    feeConfigExists,
                    feeHeadsCount: schoolFeeHeadsList.length,
                    feeHeadsList: schoolFeeHeadsList
                },
                totalClasses: classes.length,
                classesReady: classReports.filter(c => c.status === "ready").length,
                classesPartial: classReports.filter(c => c.status === "partial").length,
                classesNotConfigured: classReports.filter(c => c.status === "not_configured").length,
                classes: classReports.sort((a, b) => a.classPercentage - b.classPercentage) // worst first, so admin sees what needs attention
            }
        });

    } catch (error: any) {
        console.error("Get School Setup Status Error:", error);
        return res.status(500).json({ 
            ok: false, 
            message: "Failed to fetch school setup status." 
        });
    }
};
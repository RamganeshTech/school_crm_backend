import type { Response } from "express";
import HomeWorkSubmissionModel from "../../../models/New_Model/HomeWork_model/HomeWorkSubmission.model.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";

export const submitHomeworkStatus = async (req: RoleBasedRequest, res: Response) => {
    try {
        let { homeworkId, subjectId, studentId, remarks, academicYear, status } = req.body;

        // 1. Determine schoolId: Prioritize the authenticated user's schoolId
        const schoolId = req.user!.schoolId || req.body.schoolId;

        if (!schoolId) {
            return res.status(400).json({ message: "School ID is required.", ok: false });
        }

        if (!academicYear) {
            // // 1. Get Academic Year (Source of Truth)
            const schoolDoc = await SchoolModel.findById(schoolId)
            academicYear = schoolDoc?.currentAcademicYear;

            if (!academicYear) {
                return res.status(500).json({
                    ok: false,
                    message: "Current Academic year is not set for the school , either set in school department or else provide the academic year"
                });
            }
        }


        if (!["completed", "pending"].includes(status?.trim())) {
            return res.status(500).json({
                ok: false,
                message: "Status should be either completed or pending only"
            });
        }
        const cleanStatus = status?.trim();
        // 2. Use findOneAndUpdate with 'upsert' to prevent duplicate submissions
        // If the student already submitted for this specific subject, update it.
        const submission = await HomeWorkSubmissionModel.findOneAndUpdate(
            {
                homeworkId,
                subjectId,
                studentId,
                schoolId
            },
            {
                academicYear,
                status: cleanStatus,
                // completedAt: new Date(),
                // Only stamp the date if they are finished
                ...(cleanStatus === "completed" && { completedAt: new Date() }),
                remarks,
                // studentAttachments
            },
            {
                new: true,
                upsert: true, // Creates a new one if it doesn't exist
                runValidators: true
            }
        );

        res.status(200).json({
            ok: true,
            message: "Homework submitted successfully",
            data: submission
        });

    } catch (error: any) {
        res.status(500).json({ message: error.message, ok: false });
    }
};


export const getAllHomeworkSubmissionsWithPaginations = async (req: RoleBasedRequest, res: Response) => {
    try {
        // 1. Get query parameters with defaults
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // 2. Filters (Teacher might want to see submissions for a specific homework or student)
        const { homeworkId, studentId, status, subjectId } = req.query;
        const schoolId = req.user!.schoolId; // Always filter by the user's school

        const filter: any = { schoolId };
        if (homeworkId) filter.homeworkId = homeworkId;
        if (studentId) filter.studentId = studentId;
        if (subjectId) filter.subjectId = subjectId;
        if (status) filter.status = status;

        // 3. Execute query with pagination
        const submissions = await HomeWorkSubmissionModel.find(filter)
            .populate("studentId", "studentName currentClassId currentSectionId") // Optional: show student details
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limit);

        // 4. Get total count for frontend pagination logic
        const totalSubmissions = await HomeWorkSubmissionModel.countDocuments(filter);

        res.status(200).json({
            ok: true,
            data: submissions,
            pagination: {
                totalSubmissions,
                currentPage: page,
                totalPages: Math.ceil(totalSubmissions / limit),
                hasNextPage: page * limit < totalSubmissions,
                hasPrevPage: page > 1
            }
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};



export const getAllHomeworkSubmissionsWithoutPaginations = async (req: RoleBasedRequest, res: Response) => {
    try {


        // 2. Filters (Teacher might want to see submissions for a specific homework or student)
        const { homeworkId, studentId, subjectId } = req.query;
        const schoolId = req.user!.schoolId; // Always filter by the user's school

        const filter: any = { schoolId };
        if (homeworkId) filter.homeworkId = homeworkId;
        if (studentId) filter.studentId = studentId;
        if (subjectId) filter.subjectId = subjectId;

        // 3. Execute query with pagination
        const submissions = await HomeWorkSubmissionModel.find(filter)
            .populate("studentId", "studentName currentClassId currentSectionId") // Optional: show student details
            .sort({ createdAt: -1 }) // Newest first

        res.status(200).json({
            ok: true,
            data: submissions,
            message: "fetched all the home work submission data"
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};



export const getSingleHomeworkSubmission = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const submission = await HomeWorkSubmissionModel.findOne({
            _id: id,
        }).populate("studentId", "studentName currentClassId currentSectionId") // Optional: show student details


        if (!submission) {
            return res.status(404).json({
                ok: false,
                message: "Submission not found or unauthorized access."
            });
        }

        res.status(200).json({
            ok: true,
            data: submission
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};
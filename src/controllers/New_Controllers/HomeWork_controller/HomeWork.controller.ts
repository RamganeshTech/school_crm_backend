import type { Response } from "express";
import HomeworkModel from "../../../models/New_Model/HomeWork_model/HomeWork.model.js";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";



const processFiles = async (filesArray: any[]) => {
    if (!filesArray || filesArray.length === 0) return [];
    return await Promise.all(
        filesArray.map(async (file) => {
            const uploadData = await uploadFileToS3New(file);
            const type = file.mimetype.startsWith("image") ? "image" : "pdf";
            return {
                url: uploadData.url,
                key: uploadData.key,
                type: type,
                originalName: file.originalname,
                uploadedAt: new Date()
            };
        })
    );
};


export const createHomework = async (req: RoleBasedRequest, res: Response) => {
    try {
        let { schoolId, academicYear, classId, sectionId, homeworkDate, subjectName, description } = req.body;
        const files: any = req.files;

        const teacherId = req.user!._id

        // 1. Restriction: Check if date is in the past
        const today = new Date().setHours(0, 0, 0, 0);
        const hDate = new Date(homeworkDate).setHours(0, 0, 0, 0);
        if (hDate < today) {
            return res.status(403).json({ ok: false, message: "Cannot create homework for past dates." });
        }


        if (!academicYear) {
            // // 1. Get Academic Year (Source of Truth)
            const schoolDoc = await SchoolModel.findById(schoolId)
            academicYear = schoolDoc?.currentAcademicYear;

            if (!academicYear) {
                return res.status(400).json({
                    ok: false,
                    message: "Current Academic year is not set for the school , either set in school department or else provide the academic year"
                });
            }
        }

        const uploadedAttachments = await processFiles(files);

        const newSubjectEntry = {
            subjectName,
            // teacherId: new mongoose.Schema.ObjectId(teacherId),
            teacherId: teacherId || null,
            description,
            attachments: uploadedAttachments,
            updatedAt: new Date()
        };

        // Upsert the daily document and push the new subject
        const homework = await HomeworkModel.findOneAndUpdate(
            { schoolId, classId, sectionId: sectionId || null, homeworkDate: hDate, academicYear },
            { $push: { subjects: newSubjectEntry } },
            { upsert: true, new: true }
        );

        return res.status(201).json({ ok: true, data: homework });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};




export const updateHomeworkText = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { homeworkId, subjectId, description, subjectName } = req.body;
        const teacherId = req.user!._id

        const result = await HomeworkModel.findOneAndUpdate(
            { _id: homeworkId, "subjects._id": subjectId },
            {
                $set: {
                    "subjects.$.description": description,
                    "subjects.$.subjectName": subjectName,
                    "subjects.$.updatedAt": new Date(),
                    "subjects.$.teacherId": teacherId
                }
            },
            { new: true }
        );

        return res.status(200).json({ ok: true, message: "Text updated", data: result });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};



export const addHomeworkAttachments = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { homeworkId, subjectId } = req.body;
        const files: any = req.files;

        const teacherId = req.user!._id

        const newFiles = await processFiles(files);

        const result = await HomeworkModel.findOneAndUpdate(
            { _id: homeworkId, "subjects._id": subjectId },
            {
                $push: { "subjects.$.attachments": { $each: newFiles } },
                $set: {

                    "subjects.$.updatedAt": new Date(),
                    "subjects.$.teacherId": teacherId

                }


            },
            { new: true }
        );

        return res.status(200).json({ ok: true, data: result });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const deleteHomeworkAttachment = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { homeworkId, subjectId, attachmentId } = req.body;

        const result = await HomeworkModel.findOneAndUpdate(
            { _id: homeworkId, "subjects._id": subjectId },
            { $pull: { "subjects.$.attachments": { _id: attachmentId } } },
            { new: true }
        );

        return res.status(200).json({ ok: true, message: "Attachment removed", data: result });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};

export const getAllHomework = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, classId, sectionId, page = 1, limit = 10, academicYear } = req.query;
        const query = { schoolId, classId, sectionId: sectionId || null, academicYear };

        const data = await HomeworkModel.find(query)
            .sort({ homeworkDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate("subjects.teacherId", "userName _id");

        const count = await HomeworkModel.countDocuments(query);

        return res.status(200).json({
            ok: true, data,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            pagination: {
                total: count,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                limit: limit
            }
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const deleteSubjectFromHomework = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { homeworkId, subjectId } = req.body;

        if (!homeworkId || !subjectId) {
            return res.status(400).json({ ok: false, message: "homeworkId and subjectId are required" });
        }

        const result = await HomeworkModel.findByIdAndUpdate(
            homeworkId,
            { $pull: { subjects: { _id: subjectId } } },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ ok: false, message: "Homework document not found" });
        }

        return res.status(200).json({
            ok: true,
            message: "Subject removed from today's homework",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};



export const getSingleHomework = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { homeworkId } = req.params;

        const homework = await HomeworkModel.findById(homeworkId)
            .populate("classId sectionId", "name")
            .populate("subjects.teacherId", "userName email profileImage");

        if (!homework) {
            return res.status(404).json({ ok: false, message: "Homework record not found" });
        }

        return res.status(200).json({ ok: true, data: homework });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};




// ==========================================================
// DELETE ENTIRE DAILY HOMEWORK DOCUMENT
// ==========================================================
export const deleteDailyHomework = async (req: RoleBasedRequest, res: Response) => {
    try {
        // We take the ID from the body or params as per your preference
        const { homeworkId } = req.body;

        if (!homeworkId) {
            return res.status(400).json({ ok: false, message: "homeworkId is required" });
        }

        const deletedDoc = await HomeworkModel.findByIdAndDelete(homeworkId);

        if (!deletedDoc) {
            return res.status(404).json({ ok: false, message: "Record not found" });
        }

        // Optional: If you want to be extra thorough, you could trigger 
        // a function here to delete all files in deletedDoc.subjects.attachments from S3.

        return res.status(200).json({
            ok: true,
            message: "Entire day's homework has been deleted successfully"
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};
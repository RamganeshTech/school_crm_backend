// import { ClubVideoModel, ClubMainModel } from "../models/yourModelFile.js"; // Update path
// import { uploadFileToS3New } from "../utils/s3Utils.js"; // Assuming this is where your S3 logic is

import type { Response } from "express";
import { ClubMainModel, ClubVideoModel } from "../../../models/New_Model/club_model/club.model.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { formatUploadData, processFilesClub } from "./club.controller.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";

// ==========================================
// 1. Create/Upload Video
// ==========================================
export const createClubVideo = async (req: RoleBasedRequest, res: Response) => {
    try {
        let { schoolId, clubId, title, topic, level, academicYear } = req.body;
        const file = req.file; // CHANGED: Access array of files

        console.log("file", file)


        // return res.status(200).json({ok:true});

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


        const clubExists = await ClubMainModel.findById(clubId);
        if (!clubExists) {
            return res.status(404).json({ ok: false, message: "The selected club does not exist." });
        }

        let videoDocument = null;
        if (file) {
            videoDocument = await formatUploadData(file);
        }

        // 3. Save All to DB (Bulk Insert)
        const savedVideos = await ClubVideoModel.create({
            academicYear: academicYear || null,
            clubId: clubId, // Mapping clubId to schema key 'club'
            title: title ? title?.trim() : null,
            topic: topic ? topic?.trim() : null,
            level: level || 'general',
            video: videoDocument,
            uploadedBy: req.user?._id
        });

        await createAuditLog(req, {
            action: "create",
            module: "club",
            targetId: savedVideos._id,
            description: `video uploaded in club (${savedVideos._id})`,
            status: "success"
        });

        res.status(201).json({
            ok: true, message: `videos uploaded successfully`,
            data: savedVideos
        });

    } catch (error: any) {
        console.error("Upload Video Error:", error);
        res.status(500).json({ ok: false, message: "Server error while uploading videos", error: error.message });
    }
};


export const updateClubVideoFile = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const file = req.file;

        // 1. Validation: Ensure a file was actually sent
        if (!file) {
            return res.status(400).json({ ok: false, message: "No new video file provided for update." });
        }

        // // 2. Validation: Ensure the record exists before processing upload
        // const existingVideo = await ClubVideoModel.findById(id);
        // if (!existingVideo) {
        //     return res.status(404).json({ ok: false, message: "Video record not found." });
        // }

        // 3. Process Upload (Upload to S3)
        // This uses your helper to get { url, key, type, ... }
        const newVideoData = await formatUploadData(file);

        // 4. Update Database
        // We strictly update ONLY the 'video' field
        const updatedVideo: any = await ClubVideoModel.findByIdAndUpdate(
            id,
            { $set: { video: newVideoData } },
            { new: true } // Returns the updated document
        );

        // Optional: You could delete the OLD video from S3 here using existingVideo.video.key
        // to save storage costs, but that depends on your preference.

        await createAuditLog(req, {
            action: "edit",
            module: "club",
            targetId: updatedVideo._id,
            description: `new video got updated in club (${updatedVideo._id})`,
            status: "success"
        });

        res.status(200).json({
            ok: true, message: "Video file updated successfully",
            data: updatedVideo
        });

    } catch (error: any) {
        console.error("Update Video File Error:", error);
        res.status(500).json({ ok: false, message: "Server error while updating video file", error: error.message });
    }
};

export const deleteClubVideoFile = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id, fileId } = req.params;

        // Use $pull to remove the specific PDF by its _id inside the pdfs array
        const updatedVideo = await ClubVideoModel.findByIdAndUpdate(
            id,
            { $pull: { pdfs: { _id: fileId } } },
            { new: true }
        );

        if (!updatedVideo) {
            return res.status(404).json({ ok: false, message: "Video record not found." });
        }

        await createAuditLog(req, {
            action: "delete",
            module: "club",
            targetId: updatedVideo._id,
            description: `Deleted an attached PDF from video (${updatedVideo._id})`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: "File deleted successfully",
            data: updatedVideo
        });

    } catch (error: any) {
        console.error("Delete Video File Error:", error);
        res.status(500).json({ ok: false, message: "Server error while deleting file", error: error.message });
    }
};

export const uploadClubPDF = async (req: RoleBasedRequest, res: Response) => {
    try {

        const { id } = req.params;
        const files: any = req.files;

        // // 1. Validation: Ensure a file was actually sent
        // if (!file) {
        //     return res.status(400).json({ ok: false, message: "No new video file provided for update." });
        // }

        // // 2. Validation: Ensure the record exists before processing upload
        // const existingVideo = await ClubVideoModel.findById(id);
        // if (!existingVideo) {
        //     return res.status(404).json({ ok: false, message: "Video record not found." });
        // }

        // 3. Process Upload (Upload to S3)
        // This uses your helper to get { url, key, type, ... }


        // const newVideoData = await formatUploadData(file);


        // 1. Validation
        if (!files || files.length === 0) {
            return res.status(400).json({ ok: false, message: "No PDF files provided for uploading." });
        }

        const uploadedPdfs = await processFilesClub(files);


        // 4. Update Database
        // We strictly update ONLY the 'video' field
        const updatedVideo: any = await ClubVideoModel.findByIdAndUpdate(
            id,
            { $push: { pdfs: { $each: uploadedPdfs } } },
            { new: true } // Returns the updated document
        );

        // Optional: You could delete the OLD video from S3 here using existingVideo.video.key
        // to save storage costs, but that depends on your preference.

        await createAuditLog(req, {
            action: "edit",
            module: "club",
            targetId: updatedVideo._id,
            description: `new pdf got updated in club (${updatedVideo._id})`,
            status: "success"
        });

        res.status(200).json({
            ok: true, message: "Pdf file updated successfully",
            data: updatedVideo
        });

    }
    catch (error: any) {
        console.error("Upload club pdf Error:", error);
        res.status(500).json({ ok: false, message: "error while uploading the pdf", error: error.message });
    }
}

// ==========================================
// 2. Get All Videos (Filter by Club)
// ==========================================
export const getAllClubVideos = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { clubId, topic, level } = req.query;

        // 1. Pagination Setup
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // 2. Build Query
        const query: any = {};

        // Filter by Club (Essential)
        if (clubId) query.clubId = clubId;

        // Optional Filters
        if (topic) query.topic = topic;
        if (level) query.level = level;

        // 3. Execute Queries in Parallel
        // We need two things: Total count (for UI pagination) and the actual Data
        const [totalVideos, videos] = await Promise.all([
            ClubVideoModel.countDocuments(query), // Count matching docs
            ClubVideoModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('clubId', 'name _id') // Optional: Populate club name
        ]);

        const totalPages = Math.ceil(totalVideos / limit);

        // 4. Send Response
        res.status(200).json({
            ok: true,
            message: "Videos fetched successfully",
            data: videos,
            pagination: {
                totalVideos,
                totalPages,
                currentPage: page,
                limit
            }
        });

    } catch (error: any) {
        console.error("Error fetching videos:", error);
        res.status(500).json({ ok: false, message: "Error fetching videos", error: error.message });
    }
};
// ==========================================
// 3. Get Video By ID
// ==========================================
export const getClubVideoById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const video = await ClubVideoModel.findById(id).populate('clubId', 'name description');

        if (!video) {
            return res.status(404).json({ ok: false, message: "Video not found" });
        }

        res.status(200).json({ ok: true, data: video });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error fetching video details", error: error.message });
    }
};

// ==========================================
// 4. Update Video Details ONLY (Title, Topic, Level)
// ==========================================
export const updateClubVideoDetails = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, topic, level, academicYear } = req.body;

        // We specifically DO NOT check for req.file here.
        // Even if a file is sent, it is ignored.

        // 1. Create a dynamic update object
        const updateFields: any = {};

        // 2. Only add fields if they are provided (not undefined/null)
        if (title) updateFields.title = title;
        if (topic) updateFields.topic = topic;
        if (level) updateFields.level = level;

        // This solves your specific requirement:
        // academicYear is only added to the update if it exists in req.body
        if (academicYear) {
            updateFields.academicYear = academicYear;
        }


        const updatedVideo = await ClubVideoModel.findByIdAndUpdate(
            id,
            {
                $set: updateFields
            },
            { new: true, runValidators: true }
        );

        if (!updatedVideo) {
            return res.status(404).json({ ok: false, message: "Video not found" });
        }

        await createAuditLog(req, {
            action: "edit",
            module: "club",
            targetId: updatedVideo._id,
            description: `video details got updated in club (${updatedVideo._id})`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: "Video details updated successfully",
            data: updatedVideo
        });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error updating video details", error: error.message });
    }
};

// ==========================================
// 5. Delete Video
// ==========================================
export const deleteClubVideo = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        // const video = await ClubVideoModel.findById(id);
        // if (!video) {
        //     return res.status(404).json({ message: "Video not found" });
        // }

        // OPTIONAL: Delete from S3 logic here
        // if (video.video && video.video.key) {
        //     await deleteFileFromS3(video.video.key);
        // }

        const isExist = await ClubVideoModel.findByIdAndDelete(id);

        if (!isExist) {
            return res.status(404).json({ message: "video not found", ok: false })
        }

        await createAuditLog(req, {
            action: "delete",
            module: "club",
            targetId: isExist._id,
            description: `video got deleted (${isExist._id})`,
            status: "success"
        });

        res.status(200).json({ ok: true, message: "Video deleted successfully" });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error deleting video", error: error.message });
    }
};
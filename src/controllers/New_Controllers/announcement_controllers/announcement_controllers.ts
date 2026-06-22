import mongoose from "mongoose";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import { AnnouncementModel } from "../../../models/New_Model/announcement_model/announcement.model.js";
// import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import StudentNewModel from "../../../models/New_Model/StudentModel/studentNew.model.js";
import UserModel from "../../../models/New_Model/UserModel/userModel.model.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import { getIO } from "../../../config/socket.js";

export const createAnnouncement = async (req: RoleBasedRequest, res: Response) => {
    try {
        let {
            schoolId,
            academicYear,
            title, description, type, priority,
            targetAudience, targetClasses, // Coming from Body
            // publishDate, expiryDate
        } = req.body;

        const userId = req?.user?._id;

        // 1. Basic Validation
        if (!schoolId || !title || !targetAudience) {
            return res.status(400).json({ ok: false, message: "Missing required fields: schoolId, title, targetAudience" });
        }

        // 2. PARSE TARGET AUDIENCE (Ensure it is an Array)
        // -----------------------------------------------------
        let parsedAudience = [];

        // FormData sends arrays as JSON strings (e.g., '["parent", "specific_classes"]')
        // or sometimes just the array if using raw JSON body.
        if (typeof targetAudience === 'string') {
            try {
                parsedAudience = JSON.parse(targetAudience);
            } catch (e) {
                // Should not happen if frontend sends JSON array string, but safe fallback
                return res.status(400).json({ ok: false, message: "targetAudience must be a valid JSON array string." });
            }
        } else if (Array.isArray(targetAudience)) {
            parsedAudience = targetAudience;
        }


        // Ensure we work with lowercase for comparison
        parsedAudience = parsedAudience.map((a: any) => a.toLowerCase());

        const allowedAudiences = ["all", "parent", "teacher", "student", "specific_classes"];
        const hasInvalidValue = parsedAudience.some((role: any) => !allowedAudiences.includes(role));

        if (hasInvalidValue) {
            return res.status(400).json({
                ok: false,
                message: `Invalid target audience. Allowed values: ${allowedAudiences.join(", ")}`
            });
        }


        // 2. ROBUST PARSING for Target Classes
        let finalClassIds = [];

        // Note: Check against lowercase 'specific_classes' to match your logic
        if (targetAudience.includes("specific_classes")) {
            if (!targetClasses) {
                return res.status(400).json({ ok: false, message: "Please select at least one class." });
            }

            try {
                // Step A: Parse String back to JSON (if coming from FormData)
                const parsed = typeof targetClasses === 'string' ? JSON.parse(targetClasses) : targetClasses;

                // Step B: Extract IDs safely
                if (Array.isArray(parsed)) {
                    finalClassIds = parsed.map(item => {
                        // Case 1: Item is just a string ID ["id1", "id2"]
                        if (typeof item === 'string') return item;

                        // Case 2: Item is an object from a dropdown [{ _id: "id1", name: "A" }]
                        if (typeof item === 'object' && item !== null) {
                            return item._id || item.value; // Check common key names
                        }
                        return null;
                    }).filter(id => id); // Remove nulls/undefined
                }
            } catch (err) {
                // console.error("Parsing Error:", err);
                // return res.status(400).json({ ok: false, message: "Invalid format for targetClasses" });
                console.error("Class Parsing Error:", err);
                return res.status(400).json({
                    ok: false,
                    message: "Invalid format for targetClasses. Must be an array of IDs or Objects. either ['id1', 'id2'] or [{ _id: 'id1', name: '6' }]"
                });
            }

            if (finalClassIds.length === 0) {
                return res.status(400).json({ ok: false, message: "Please select at least one valid class." });
            }
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

        // 4. Handle Attachments (Images, PDFs, Videos)
        let attachments: any[] = [];
        if (req.files && (req?.files?.length as number) > 0) {
            attachments = await Promise.all(
                (req.files as []).map(async (file: any) => {
                    const uploadData = await uploadFileToS3New(file);

                    // Determine Type
                    let fileType = "pdf";
                    if (file.mimetype.startsWith("image/")) fileType = "image";
                    else if (file.mimetype.startsWith("video/")) fileType = "video";

                    return {
                        _id: new mongoose.Types.ObjectId(),
                        type: fileType,
                        key: uploadData.key,
                        url: uploadData.url,
                        originalName: file.originalname,
                        uploadedAt: new Date()
                    };
                })
            );
        }

        // 5. Save to DB
        const newAnnouncement = new AnnouncementModel({
            schoolId,
            academicYear,
            title,
            description,
            type: type || "announcement",
            priority: priority || "normal",
            targetAudience: parsedAudience,
            targetClasses: finalClassIds,
            attachments,
            createdBy: userId,

            // Logic: If user didn't provide dates, default Publish to NOW, Expiry to NULL
            // publishDate: publishDate || new Date(),
            // expiryDate: expiryDate || null
        });

        await newAnnouncement.save();

        // --- NEW: EMIT REAL-TIME EVENT ---
        try {
            // Get the socket instance and broadcast to the specific school room
            const io = getIO();
            io.to(schoolId.toString()).emit("new_announcement", newAnnouncement);
        } catch (socketError) {
            console.error("Socket emission failed, but announcement was created:", socketError);
        }

        await createAuditLog(req, {
            action: "create",
            module: "announcement",
            targetId: newAnnouncement._id,
            description: `announcement created (${newAnnouncement._id})`,
            status: "success"
        });

        // TODO: Trigger Push Notifications here (FCM) based on targetAudience

        res.status(201).json({
            ok: true,
            message: "Announcement created successfully",
            data: newAnnouncement
        });

    } catch (error: any) {
        console.error("Create Announcement Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};



export const getAnnouncements = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, page = 1, limit = 10 } = req.query; // ONLY schoolId comes from Frontend
        const userRole: string = req.user?.role?.toLowerCase()!;
        const userId = req.user?._id;

        console.log("userRole", userRole)

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId required" });
        }

        // --- PRE-CALCULATION: Find Allowed Class IDs ---
        // We will populate this array based on whether it's a Teacher (assignments) or Parent (children)
        let allowedClassIds: any[] = [];

        if (userRole === "teacher") {
            // 1. Fetch Teacher's Assignments
            const teacherUser: any = await UserModel.findById(userId).select("assignments");

            if (teacherUser?.assignments?.length > 0) {
                // Extract classId from every assignment object
                allowedClassIds = teacherUser.assignments
                    .map((a: any) => a.classId)
                    .filter((id: any) => id); // Remove nulls/undefined
            }
        }
        else if (userRole === "parent") {
            // 1. Fetch Parent's Student IDs
            const parentUser: any = await UserModel.findById(userId).select("studentId");

            // console.log("parentUser", parentUser)
            if (parentUser?.studentId?.length > 0) {
                // 2. Fetch the actual Student documents to get their Classes
                const students = await StudentNewModel.find({
                    _id: { $in: parentUser.studentId }
                }).select("currentClassId");


                // console.log("students", students)

                // 3. Extract class IDs from the students
                allowedClassIds = students
                    .map(s => s.currentClassId)
                    .filter(id => id); // Remove nulls/undefined

                // console.log("allowedClassIds", allowedClassIds)

            }
        }

        // --- QUERY CONSTRUCTION ---
        let query: any = {
            schoolId: new mongoose.Types.ObjectId(schoolId),
        };

        // =========================================================
        // ROLE BASED FILTERS
        // =========================================================

        // A. ADMINS (See Everything)
        if (["administrator", "principal", "correspondent", "viceprincipal"].includes(userRole)) {
            // No extra filters needed.
        }

        // B. TEACHERS
        else if (userRole === "teacher") {
            query.$or = [
                // 1. General Teacher Announcements
                { targetAudience: { $in: ["all", "teacher"] } },

                // 2. Class Specific Announcements (Matches ANY class in their assignments)
                {
                    targetAudience: "specific_classes",
                    targetClasses: { $in: allowedClassIds }
                }
            ];
        }

        // C. PARENTS
        else if (userRole === "parent") {

            // Logic: Must match "parent" AND NOT be "specific_classes" to be considered General
            const generalParentRule = {
                $and: [
                    { targetAudience: "parent" },
                    { targetAudience: { $ne: "specific_classes" } }
                ]
            };

            // Logic:
            // 1. Public (All)
            // 2. General Parent News
            // 3. Specific Class News (Matches ANY of their children's classes)
            query.$or = [
                { targetAudience: "all" },
                generalParentRule,
                {
                    targetAudience: "specific_classes",
                    targetClasses: { $in: allowedClassIds }
                }
            ];
        }

        // D. FALLBACK
        else {
            return res.status(403).json({ ok: false, message: "Access Denied: Unknown Role" });
        }

        // =========================================================
        // EXECUTION
        // =========================================================
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [announcements, total] = await Promise.all([
            AnnouncementModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate("createdBy", "userName role _id")
                .populate("targetClasses", "name _id"), // Shows "Class 10-A", etc.
            AnnouncementModel.countDocuments(query)
        ]);

        res.status(200).json({
            ok: true,
            data: announcements,
            pagination: {
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error: any) {
        console.error("Get Announcements Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

export const getAnnouncementById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        // 1. Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: "Invalid Announcement ID" });
        }

        // 2. Fetch the Announcement
        const announcement = await AnnouncementModel.findById(id)
            .populate("createdBy", "userName role _id")
            .populate("targetClasses", "name _id"); // Populate class names if specific

        // 3. Check Existence & Soft Delete
        if (!announcement) {
            return res.status(404).json({ ok: false, message: "Announcement not found" });
        }

        // =========================================================
        // ACCESS CONTROL LOGIC
        // =========================================================

        // const isAdminLevel = ["correspondent", "principal", "viceprincipal", "administrator"].includes(userRole);

        // // A. ADMINS: Can see everything. Skip checks.
        // if (isAdminLevel) {
        //     return res.status(200).json({ ok: true, data: announcement });
        // }


        // // Check 3: Audience Validation
        // // const audience = announcement.targetAudience;

        // // Ensure audience is always an array (handles cases where DB might return a string or array)
        // const audience = Array.isArray(announcement.targetAudience)
        //     ? announcement.targetAudience
        //     : [announcement.targetAudience];


        // if (userRole === "teacher") {
        //     // Teachers can see "ALL" and "STAFF"
        //     const isAllowed = audience.some(role => ["all", "teacher"].includes(role));

        //     if (!isAllowed) {
        //         return res.status(403).json({ ok: false, message: "Access Denied. This is not for teachers." });
        //     }
        // }
        // else if (userRole === "parent") {
        //     // Parents/Students can see "ALL", "PARENTS", "STUDENTS"
        //     const allowedGeneral = ["all", "parent"];

        //     if (audience.includes("specific_classes")) {
        //         // Must provide classId to verify access
        //         if (!classId) {
        //             return res.status(400).json({
        //                 ok: false,
        //                 message: "classId is required to view class-specific announcements."
        //             });
        //         }

        //         // Check if the announcement's targetClasses includes the student's class
        //         // const isClassTargeted = announcement.targetClasses.some(
        //         //     cls => cls._id.toString() === classId
        //         // );

        //         const isClassTargeted = announcement.targetClasses.some(cls => {
        //             const clsId = cls._id ? cls._id.toString() : cls.toString();
        //             return clsId === classId;
        //         });

        //         if (!isClassTargeted) {
        //             return res.status(403).json({ ok: false, message: "This announcement is not for your class." });
        //         }
        //     }
        //     // else if(!allowedGeneral.includes(audience)) {
        //     else {
        //         // return res.status(403).json({ ok: false, message: "Access Denied." });
        //         const hasGeneralAccess = audience.some(role => allowedGeneral.includes(role));

        //         if (!hasGeneralAccess) {
        //             return res.status(403).json({ ok: false, message: "Access Denied." });
        //         }
        //     }
        // }

        // If all checks pass:
        res.status(200).json({
            ok: true,
            data: announcement
        });

    } catch (error: any) {
        console.error("Get Announcement By ID Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};


export const updateAnnouncementText = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const {
            academicYear,
            title, description, type, priority,
            targetAudience, targetClasses,
            // publishDate, expiryDate
        } = req.body;



        // 2. Find Existing
        const announcement: any = await AnnouncementModel.findById(id);
        if (!announcement) {
            return res.status(404).json({ ok: false, message: "Announcement not found" });
        }


        let parsedAudience = announcement.targetAudience;

        if (targetAudience) {
            if (Array.isArray(targetAudience)) {
                parsedAudience = targetAudience;
            } else if (typeof targetAudience === 'string') {
                try {
                    // Try JSON parse e.g. '["parent", "specific_classes"]'
                    parsedAudience = JSON.parse(targetAudience);
                } catch (e) {
                    // Fallback to comma split or single value
                    parsedAudience = targetAudience.split(',').map(s => s.trim());
                }
            }
            // Normalize
            parsedAudience = parsedAudience.map((a: string) => a.toLowerCase());
        }


        // 3. Logic: Parse Target Classes if Audience is Specific
        let finalClassIds = announcement.targetClasses; // Default to existing

        // Check if audience is changing or classes are provided
        if (targetAudience) {
            if (parsedAudience.includes("specific_classes")) {                // If switching to specific, classes must be provided or exist
                if (targetClasses) {
                    try {
                        const parsed = typeof targetClasses === 'string' ? JSON.parse(targetClasses) : targetClasses;
                        if (Array.isArray(parsed)) {
                            finalClassIds = parsed.map(item => {
                                if (typeof item === 'string') return item;
                                if (typeof item === 'object' && item !== null) return item._id || item.value || item.id;
                                return null;
                            }).filter(id => id);
                        }
                    } catch (err) {
                        return res.status(400).json({ ok: false, message: "Invalid format for targetClasses" });
                    }
                } else if (announcement.targetAudience !== "specific_classes") {
                    // Switching to specific but didn't provide classes
                    return res.status(400).json({ ok: false, message: "Target classes required when audience is specific." });
                }
            }
            else {
                // User didn't provide new classes.
                // If the OLD audience didn't include specific_classes, we can't switch to it without classes.
                const wasSpecificBefore = announcement.targetAudience.includes("specific_classes");

                if (!wasSpecificBefore) {
                    return res.status(400).json({ ok: false, message: "Target classes required when switching to 'specific_classes'." });
                }
                // If it was specific before, we keep the existing finalClassIds (line 46)
            }

            if (finalClassIds.length === 0) {
                return res.status(400).json({ ok: false, message: "At least one class is required." });
            }
        }  // CASE B: New audience does NOT include "specific_classes"
        else {
            // Clear the classes array as it's no longer needed
            finalClassIds = [];
        }


        // 4. Update Fields (Only if provided)
        if (academicYear) announcement.academicYear = academicYear;
        if (title) announcement.title = title;
        if (description) announcement.description = description;
        if (type) announcement.type = type;
        if (priority) announcement.priority = priority;
        if (targetAudience) announcement.targetAudience = targetAudience;
        // if (publishDate) announcement.publishDate = publishDate;

        // Handle Expiry Date (Allow nulling it out)
        // if (expiryDate !== undefined) announcement.expiryDate = expiryDate;

        announcement.targetClasses = finalClassIds;

        await announcement.save();

        await createAuditLog(req, {
            action: "edit",
            module: "announcement",
            targetId: announcement._id,
            description: `announcement details updated (${announcement._id})`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: "Announcement details updated",
            data: announcement
        });

    } catch (error: any) {
        console.error("Update Text Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};



export const addAnnouncementAttachments = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;


        // 2. Check Files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ ok: false, message: "No files uploaded" });
        }

        // 3. Find Announcement
        const announcement = await AnnouncementModel.findById(id);
        if (!announcement) {
            return res.status(404).json({ ok: false, message: "Announcement not found" });
        }

        // 4. Upload Files
        const newAttachments: any = await Promise.all(
            (req.files as any[]).map(async (file) => {
                const uploadData = await uploadFileToS3New(file);

                let fileType = "pdf";
                if (file.mimetype.startsWith("image/")) fileType = "image";
                else if (file.mimetype.startsWith("video/")) fileType = "video";

                return {
                    _id: new mongoose.Types.ObjectId(),
                    type: fileType,
                    key: uploadData.key,
                    url: uploadData.url,
                    originalName: file.originalname,
                    uploadedAt: new Date()
                };
            })
        );

        // 5. Push to Array (Append)
        announcement.attachments.push(...newAttachments);
        await announcement.save();

        await createAuditLog(req, {
            action: "edit",
            module: "announcement",
            targetId: announcement._id,
            description: `announcement uploaded some files (${announcement._id})`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: `${newAttachments.length} file(s) added successfully`,
            data: announcement.attachments
        });

    } catch (error: any) {
        console.error("Add Attachment Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};


export const deleteAnnouncementAttachment = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id, fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({ ok: false, message: "fileId is required" });
        }

        // 2. Find Announcement
        const announcement: any = await AnnouncementModel.findById(id);
        if (!announcement) {
            return res.status(404).json({ ok: false, message: "Announcement not found" });
        }

        // 3. Check if file exists in array
        const fileExists = announcement.attachments.some((att: any) => {

            console.log("fileId", fileId.toString())
            console.log("att._id", att._id.toString())
            return att._id?.toString() === fileId?.toString()
        });
        if (!fileExists) {
            return res.status(404).json({ ok: false, message: "File not found in this announcement" });
        }

        // 4. Delete from S3
        // await deleteFileFromS3(fileKey);

        // 5. Remove from DB Array ($pull)
        await AnnouncementModel.findByIdAndUpdate(id, {
            $pull: { attachments: { _id: fileId } }
        });

        await createAuditLog(req, {
            action: "edit",
            module: "announcement",
            targetId: announcement._id,
            description: `announcement file got deleted (${announcement._id})`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: "Attachment deleted successfully"
        });

    } catch (error: any) {
        console.error("Delete Attachment Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};



export const deleteAnnouncement = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;


        // 2. Soft Delete (Update Flag)
        const updated: any = await AnnouncementModel.findByIdAndDelete(
            id
        );


        // 2. CALL THE ARCHIVE UTILITY
        await archiveData({
            schoolId: updated.schoolId,
            category: "annoucement",
            originalId: updated._id,
            deletedData: updated.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req?.user?._id! || null,
            reason: null, // Optional reason from body
        });

        await createAuditLog(req, {
            action: "delete",
            module: "announcement",
            targetId: updated._id,
            description: `announcement deleted (${updated._id})`,
            status: "success"
        });


        if (!updated) {
            return res.status(404).json({ ok: false, message: "Announcement not found" });
        }

        res.status(200).json({
            ok: true,
            message: "Announcement deleted successfully",
            data: updated
        });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};
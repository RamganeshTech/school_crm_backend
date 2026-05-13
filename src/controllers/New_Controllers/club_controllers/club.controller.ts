// import { ClubMainModel, ClubVideoModel } from "../models/yourModelFile.js"; // Update path

import type { Response } from "express";
import { ClubMainModel, ClubVideoModel } from "../../../models/New_Model/club_model/club.model.js";
import StudentNewModel from "../../../models/New_Model/StudentModel/studentNew.model.js";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";
// import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";

// Helper function to format the file object for your UploadSchema
export const formatUploadData = async (file:any) => {
    if (!file) return null;
    const uploadData = await uploadFileToS3New(file);
    const type = file.mimetype.startsWith("image") ? "image" : "video";
    return {
        url: uploadData.url,
        key: uploadData.key,
        type: type,
        originalName: file.originalname,
        uploadedAt: new Date()
    };
};




export const processFilesClub = async (filesArray:any[]) => {
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


// ========
// ==========================================
// 1. Create Club (With Optional Thumbnail)
// ==========================================
export const createClub = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { name, description, schoolId, classId } = req.body;

        const file = req.file
        // Check if club name already exists for this school
        const existingClub = await ClubMainModel.findOne({ name, schoolId });
        if (existingClub) {
            return res.status(400).json({ ok: false, message: "A club with this name already exists." });
        }

        // Handle Thumbnail Upload (if file provided)
        let thumbnailData = null;

        if (file) {
            thumbnailData = await formatUploadData(file);
        }

        const newClub = new ClubMainModel({
            schoolId,
            classId: classId || null,
            name,
            description,
            thumbnail: thumbnailData, // Can be null if no file uploaded
            isActive: true
        });

        await newClub.save();


        await createAuditLog(req, {
            action: "create",
            module: "club",
            targetId: newClub._id,
            description: `club created (${newClub._id})`,
            status: "success"
        });

        res.status(201).json({
            ok: true,
            message: "Club created successfully",
            data: newClub
        });

    } catch (error: any) {
        console.error("Create Club Error:", error);
        res.status(500).json({ ok: false, message: "Server error while creating club" });
    }
};

// ==========================================
// 2. Get All Clubs (with Filters)
// ==========================================
export const getAllClubs = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, classId } = req.query;

        // 1. Pagination Setup
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Default to 10 clubs per page
        const skip = (page - 1) * limit;

        // 2. Build Query
        const query:any = {};
        if (schoolId) query.schoolId = schoolId;
        if (classId) query.classId = classId;

        // Optional: Filter active clubs only
        // if (req.user?.role === 'student') query.isActive = true;

        // 3. Execute Data Query and Count Query in Parallel
        const [totalClubs, clubs] = await Promise.all([
            ClubMainModel.countDocuments(query), // Get total count for pagination UI
            ClubMainModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
        ]);

        const totalPages = Math.ceil(totalClubs / limit);

        // 4. Response
        res.status(200).json({
            ok: true,
            message: "Clubs fetched successfully",
            data: clubs,
            pagination: {
                totalClubs,
                totalPages,
                currentPage: page,
                limit
            }
        });

    } catch (error: any) {
        console.error("Error fetching clubs:", error);
        res.status(500).json({ ok: false, message: "Error fetching clubs" });
    }
};

// ==========================================
// 3. Get Single Club by ID
// ==========================================
export const getClubById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const club = await ClubMainModel.findById(id).populate("studentId classId")

        if (!club) {
            return res.status(404).json({ ok: false, message: "Club not found" });
        }

        res.status(200).json({ ok: true, data: club });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error fetching club details", error: error?.message });
    }
};

// ==========================================
// 4. Update Text Content Only (No File)
// ==========================================
export const updateClubText = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, isActive, classId } = req.body;

        // We explicitly ONLY update text fields here. 
        // We ignore any file uploads sent to this endpoint.
        const updatedClub = await ClubMainModel.findByIdAndUpdate(
            id,
            {
                $set: {
                    name,
                    classId: classId || null,
                    description,
                    isActive
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedClub) {
            return res.status(404).json({ ok: false, message: "Club not found" });
        }

        await createAuditLog(req, {
            action: "edit",
            module: "club",
            targetId: updatedClub._id,
            description: `club details updated (${updatedClub._id})`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: "Club details updated successfully",
            data: updatedClub
        });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error updating club details", error: error.message });
    }
};

// ==========================================
// 5. Update Thumbnail Only
// ==========================================
export const updateClubThumbnail = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        // 1. Check if file is present
        if (!req.file) {
            return res.status(400).json({ ok: false, message: "No image file provided" });
        }

        // 2. Format the new thumbnail data
        const newThumbnail = await formatUploadData(req.file);

        // 3. Find and Update
        const updatedClub = await ClubMainModel.findByIdAndUpdate(
            id,
            { $set: { thumbnail: newThumbnail } },
            { new: true }
        );

        if (!updatedClub) {
            return res.status(404).json({ ok: false, message: "Club not found" });
        }


        await createAuditLog(req, {
            action: "edit",
            module: "club",
            targetId: updatedClub._id,
            description: `club thumbnail updated (${updatedClub._id})`,
            status: "success"
        });

        // TODO: Optional - Delete the OLD image from S3/Storage here using the old key to save space.

        res.status(200).json({
            ok: true,
            message: "Thumbnail updated successfully",
            data: updatedClub
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ ok: false, message: "Error updating thumbnail" });
    }
};

// ==========================================
// 6. Delete Club
// ==========================================
export const deleteClub = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        // const club = await ClubMainModel.findById(id);
        // if (!club) {
        //     return res.status(404).json({ message: "Club not found" });
        // }

        // 1. Delete the Club
        const deletedOne:any = await ClubMainModel.findByIdAndDelete(id);

        // 2. CLEANUP: Delete all Videos associated with this club
        // This ensures no orphaned videos exist in the database
        await ClubVideoModel.deleteMany({ clubId: id });


        // 2. CALL THE ARCHIVE UTILITY
        await archiveData({
            schoolId: deletedOne.schoolId,
            category: "expense",
            originalId: deletedOne._id,
            deletedData: deletedOne.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req.user?._id || null,
            reason: null, // Optional reason from body
        });

        await createAuditLog(req, {
            action: "delete",
            module: "club",
            targetId: deletedOne._id,
            description: `club got deleted (${deletedOne._id})`,
            status: "success"
        });



        res.status(200).json({ ok: true, message: "Club and associated videos deleted successfully" });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error deleting club", error: error.message });
    }
};



//  ADD STUDNET TO THE CLUBS

// --- ADD STUDENT TO CLUB ---
export const addStudentToClub = async (req: RoleBasedRequest, res: Response) => {
    const { studentId, clubId } = req.body;

    try {
        // 1. Add Club ID to the Student's "clubs" array
        const studentUpdate = await StudentNewModel.findByIdAndUpdate(
            studentId,
            { $addToSet: { clubs: clubId } },
            { new: true }
        );


        if (!studentUpdate) {
            return res.status(404).json({ ok: false, message: "Student record not found" });
        }


        // 2. Add Student ID to the Club's "studentId" array
        const clubUpdate = await ClubMainModel.findByIdAndUpdate(
            clubId,
            { $addToSet: { studentId: studentId } },
            { new: true }
        );

        if (!clubUpdate) {
            return res.status(404).json({ ok: false, message: "Club record not found" });
        }

        if (!studentUpdate || !clubUpdate) {
            return res.status(404).json({ message: "Student or Club not found" });
        }

        await createAuditLog(req, {
            action: "edit",
            module: "club",
            targetId: clubUpdate._id,
            description: `Student (${studentId}) added to club  (${clubUpdate._id})`,
            status: "success"
        });

        res.status(200).json({
            message: "Student added to club successfully", ok: true, data: {
                student: studentUpdate, club: clubUpdate
            }
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error adding student to club", error: error.message });
    }
};

// --- REMOVE STUDENT FROM CLUB ---
export const removeStudentFromClub = async (req: RoleBasedRequest, res: Response) => {
    const { studentId, clubId } = req.body;

    try {
        // 1. Remove Club ID from Student
        const studentUpdate = await StudentNewModel.findByIdAndUpdate(
            studentId,
            { $pull: { clubs: clubId } }
        );

        if (!studentUpdate) {
            return res.status(404).json({ ok: false, message: "Student record not found" });
        }



        // 2. Remove Student ID from Club
        const clubUpdate = await ClubMainModel.findByIdAndUpdate(
            clubId,
            { $pull: { studentId: studentId } }
        );

        if (!clubUpdate) {
            return res.status(404).json({
                ok: false, message: "Club record not found",
            });
        }

        await createAuditLog(req, {
            action: "edit",
            module: "club",
            targetId: clubUpdate._id,
            description: `Student {${studentId}} removed to club  (${clubUpdate._id})`,
            status: "success"
        });



        res.status(200).json({
            ok: true, message: "Student removed from club successfully", data: {
                student: studentUpdate, club: clubUpdate
            }
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error removing student", error: error.message });
    }
};



export const toggleClassStudentsToClub = async (req: RoleBasedRequest, res: Response) => {
    // Frontend sends classId, which maps to currentClassId in the student model
    const { clubId, classId } = req.body;

    try {
        if (!clubId || !classId) {
            return res.status(400).json({ ok: false, message: "clubId and classId are required" });
        }

        // 1. Parallel Fetch: Get students in that class and the target club's current member list
        const [studentsInClass, targetClub] = await Promise.all([
            StudentNewModel.find({ currentClassId: classId }).select('_id studentName srId'),
            ClubMainModel.findById(clubId).select('studentId')
        ]);

        // Validation
        if (!studentsInClass.length) {
            return res.status(404).json({ ok: false, message: "No students found in the specified class" });
        }
        if (!targetClub) {
            return res.status(404).json({ ok: false, message: "Club record not found" });
        }

        const classStudentIds = studentsInClass.map(s => s._id.toString());

        // 2. INTERNAL TOGGLE LOGIC:
        // We check if any student from this class is currently in the club's studentId array.
        const isAlreadyAdded = targetClub.studentId.some(id =>
            classStudentIds.includes(id.toString())
        );

        // Determine action: If found, we remove all; if not, we add all.
        const type = isAlreadyAdded ? 'remove' : 'add';

        // 3. Define MongoDB operators
        // For Students: update their 'clubs' array
        const studentUpdate = type === 'add'
            ? { $addToSet: { clubs: clubId } }
            : { $pull: { clubs: clubId } };

        // For Club: update the 'studentId' array
        const clubUpdate = type === 'add'
            ? { $addToSet: { studentId: { $each: classStudentIds } } }
            : { $pull: { studentId: { $in: classStudentIds } } };

        // 4. Bulk Execute Updates
        // Using Promise.all to keep DB hits to a minimum and speed up execution
        await Promise.all([
            StudentNewModel.updateMany({ _id: { $in: classStudentIds } }, studentUpdate),
            ClubMainModel.findByIdAndUpdate(clubId, clubUpdate)
        ]);

        // 5. Audit Log
        await createAuditLog(req, {
            action: "edit",
            module: "club",
            targetId: clubId,
            description: `Bulk ${type} toggle: Class (${classId}) had ${classStudentIds.length} students ${type === 'add' ? 'added to' : 'removed from'} club.`,
            status: "success"
        });

        res.status(200).json({
            ok: true,
            message: `Successfully ${type === 'add' ? 'added' : 'removed'} ${classStudentIds.length} students.`,
            mode: type,
            data: studentsInClass,
            count: classStudentIds.length
        });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: "Error toggling class to club", error: error.message });
    }
};
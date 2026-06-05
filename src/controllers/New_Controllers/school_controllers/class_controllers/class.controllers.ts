// import ClassModel from "../models/ClassModel.js"; // adjust path
import mongoose from "mongoose";
// import ClassModel from "../../../../Models/New_Model/SchoolModel/classModel.model";
// import UserModel from "../../../../Models/New_Model/UserModel/userModel.model";
// import UserModel from "../../../../Models/New_Model/UserModel/userModel.model.js";
import ClassModel from "../../../../models/New_Model/SchoolModel/classModel.model.js";
// import { archiveData } from "../../deleteArchieve_controller/deleteArchieve.controller.js";
// import { createAuditLog } from "../../audit_controllers/audit.controllers.js";
import type { RoleBasedRequest } from "../../../../utils/types.js";
import type { Response } from "express";
import { createAuditLog } from "../../audit_controllers/audit.controllers.js";
import { archiveData } from "../../deleteArchieve_controller/deleteArchieve.controller.js";
import { REDIS_KEYS } from "../../../../constants/constant.js";
import redisClient from "../../../../config/redisConfig.js";

// ============================
// GET CLASSES
// ============================
export const getClasses = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;
        const cacheKey = REDIS_KEYS.schoolClasses(schoolId);

        // 1. ATTEMPT CACHE READ
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                // Cache Hit! Return instantly.
                return res.status(200).json({ ok: true, data: JSON.parse(cachedData) , message:"retrived from cache"});
            }
        } catch (redisError) {
            console.error("Redis Get Error (Classes):", redisError);
            // 🚨 Do not return here! If Redis fails, gracefully fall back to MongoDB
        }

        const classes = await ClassModel.find({ schoolId }).populate("classTeacherId", "userName email")
            .sort({ order: 1 }).lean() // IMPORTANT: Sort by order (LKG, UKG, 1, 2...)

        // 3. UPDATE CACHE
        try {
            // Cache for 1 hour (3600 seconds)
            await redisClient.setex(cacheKey, 3600, JSON.stringify(classes));
        } catch (redisError) {
            console.error("Redis Set Error (Classes):", redisError);
        }

        return res.status(200).json({ ok: true, data: classes });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// CREATE CLASS
// ============================
export const createClass = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { name, order = 0, hasSections = false } = req.body;
        const { schoolId } = req.params

        // Auto-detect schoolId from logged-in user (Best Practice)
        // const schoolId = req.user?.schoolId || req.body.schoolId;


        if (!schoolId || !name) {
            return res.status(400).json({ ok: false, message: "schoolId and name are required" });
        }

        if (order && typeof order !== "number") {
            return res.status(400).json({
                ok: false,
                message: "Order must be a number"
            });
        }

        // 2. Duplicate Check
        // Case-insensitive check (e.g., "Grade 1" vs "grade 1")
        const existing = await ClassModel.findOne({
            schoolId,
            name: { $regex: new RegExp(`^${name}$`, "i") }
        });

        if (existing) {
            return res.status(400).json({ ok: false, message: "Class name already exists for this school" });
        }

        // 3. Teacher Validation (If assigning one)

        const newClass = await ClassModel.create({
            schoolId,
            name,
            order,
            hasSections, // If true, teacher is ignored
            classTeacherId: [] // If hasSections is true, this remains null
        });

        // 🌟 INVALIDATE CACHE
        try {
            await redisClient.del(REDIS_KEYS.schoolClasses(schoolId));
        } catch (redisError) {
            console.error("Redis Del Error (Create Class):", redisError);
        }

        await createAuditLog(req, {
            action: "create",
            module: "class",
            targetId: newClass?._id,
            description: `class created (${newClass._id})`,
            status: "success"
        });

        return res.status(201).json({ ok: true, data: newClass });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, error: error?.message, message: "Internal server error" });
    }
};

// ============================
// UPDATE CLASS
// ============================
export const updateClass = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, order, hasSections } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: "Invalid class ID" });
        }

        const classDoc = await ClassModel.findById(id);
        if (!classDoc) {
            return res.status(404).json({ ok: false, message: "Class not found" });
        }

        // Check for duplicate class name if name is being updated
        if (name && name !== classDoc.name) {
            const existing = await ClassModel.findOne({
                schoolId: classDoc.schoolId,
                name: { $regex: new RegExp(`^${name}$`, "i") },
                _id: { $ne: id } // Exclude current doc
            });
            if (existing) {
                return res.status(400).json({ ok: false, message: "Class name already exists for this school" });
            }
            classDoc.name = name;
        }

        // Update fields
        // if (name) classDoc.name = name;
        if (order !== undefined) classDoc.order = order;
        if (hasSections !== undefined) classDoc.hasSections = hasSections;
        // if (classTeacherId !== undefined) classDoc.classTeacherId = classTeacherId;


        await classDoc.save();

        // 🌟 INVALIDATE CACHE 
        // Note: We use classDoc.schoolId because it's not in the request body/params
        try {
            await redisClient.del(REDIS_KEYS.schoolClasses(classDoc.schoolId.toString()));
        } catch (redisError) {
            console.error("Redis Del Error (Update Class):", redisError);
        }

        await createAuditLog(req, {
            action: "edit",
            module: "class",
            targetId: id,
            description: `class updated (${id})`,
            status: "success"
        });

        return res.status(200).json({ ok: true, data: classDoc });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// DELETE CLASS
// ============================
export const deleteClass = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: "Invalid class ID" });
        }

        // TODO: FUTURE SAFETY CHECK
        // Check if any Sections exist for this class. If so, BLOCK delete.
        // const sections = await SectionModel.findOne({ classId: id });
        // if (sections) return res.status(400).json({ message: "Delete sections first" });

        const deleted = await ClassModel.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ ok: false, message: "Class not found" });
        }

        // 🌟 INVALIDATE CACHE
        try {
            await redisClient.del(REDIS_KEYS.schoolClasses(deleted.schoolId.toString()));
        } catch (redisError) {
            console.error("Redis Del Error (Delete Class):", redisError);
        }

        await archiveData({
            schoolId: deleted.schoolId,
            category: "class",
            originalId: deleted._id,
            deletedData: deleted.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req.user!._id || null,
            reason: null, // Optional reason from body
        });

        await createAuditLog(req, {
            action: "delete",
            module: "class",
            targetId: id,
            description: `class deleted (${id})`,
            status: "success"
        });



        return res.status(200).json({ ok: true, message: "Class deleted successfully" });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

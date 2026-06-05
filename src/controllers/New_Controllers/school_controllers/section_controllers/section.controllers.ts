import SectionModel from "../../../../models/New_Model/SchoolModel/section.model.js";
import ClassModel from "../../../../models/New_Model/SchoolModel/classModel.model.js";
// import { archiveData } from "../../deleteArchieve_controller/deleteArchieve.controller.js";
// import { createAuditLog } from "../../audit_controllers/audit.controllers.js";
import type { RoleBasedRequest } from "../../../../utils/types.js";
import type { Response } from "express";
import { createAuditLog } from "../../audit_controllers/audit.controllers.js";
import { archiveData } from "../../deleteArchieve_controller/deleteArchieve.controller.js";
import redisClient from "../../../../config/redisConfig.js";
import { REDIS_KEYS } from "../../../../constants/constant.js";

// ============================
// 1. GET SECTIONS
// ============================
export const getSections = async (req: RoleBasedRequest, res: Response) => {
    try {
        // We usually fetch sections for a specific Class
        const { classId, schoolId } = req.query;

        if (!classId && !schoolId) {
            return res.status(400).json({ ok: false, message: "classId or schoolId is required" });
        }

        // Generate the specific cache key based on the query parameters
        const cacheKey = REDIS_KEYS.schoolSections(
            schoolId as string,
            classId as string | undefined
        );

        // 1. ATTEMPT CACHE READ
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                // 🌟 Cache Hit: Returning with your requested custom message
                return res.status(200).json({
                    ok: true,
                    data: JSON.parse(cachedData),
                    message: "retrieved from cache"
                });
            }
        } catch (redisError) {
            console.error("Redis Get Error (Sections):", redisError);
            // Fall through to MongoDB on Redis failure
        }

        const filter: any = {};
        if (classId) filter.classId = classId;
        if (schoolId) filter.schoolId = schoolId;

        const sections = await SectionModel.find(filter)
            .populate("classTeacherId", "userName email phoneNo")
            .populate("classId", "name") // Useful to see "Grade 10" next to "Section A"
            .sort({ name: 1 }) // Sort A, B, C...
            .lean(); // Optimize read speed

        // 3. UPDATE CACHE
        try {
            await redisClient.setex(cacheKey, 3600, JSON.stringify(sections)); // Cache for 1 hour
        } catch (redisError) {
            console.error("Redis Set Error (Sections):", redisError);
        }

        return res.status(200).json({ ok: true, data: sections });
    } catch (error: any) {
        console.error("Get Sections Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// 2. CREATE SECTION
// ============================
export const createSection = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, classId, name, roomNumber, capacity } = req.body;

        // 1. Basic Validation
        if (!schoolId || !classId || !name) {
            return res.status(400).json({ ok: false, message: "schoolId, classId, and name are required" });
        }


        // 3. Duplicate Check (Manual check + DB index backup)
        // Check if "Section A" already exists in "Grade 10"
        const existing = await SectionModel.findOne({
            classId,
            name: { $regex: new RegExp(`^${name}$`, "i") } // Case insensitive "a" vs "A"
        });

        if (existing) {
            return res.status(400).json({ ok: false, message: "Section name already exists in this class" });
        }

        // 4. Teacher Validation (If provided)
        // if (classTeacherId) {
        //   const teacher = await UserModel.findById(classTeacherId);
        //   if (!teacher ||  teacher.role !== "teacher") {
        //     return res.status(400).json({ ok: false, message: "Invalid Teacher selected" });
        //   }
        //   if (teacher.schoolId.toString() !== schoolId.toString()) {
        //     return res.status(403).json({ ok: false, message: "Teacher belongs to a different school" });
        //   }
        // }

        // 5. Create
        const newSection = await SectionModel.create({
            schoolId,
            classId,
            name,
            classTeacherId: [],
            roomNumber,
            capacity
        });

        // 2. Validate Class Logic
        const classDoc = await ClassModel.findById(classId);


        // CRITICAL CHECK: Does this class actually allow sections?
        if (classDoc && !classDoc?.hasSections) {
            classDoc.hasSections = true;
            classDoc.classTeacherId = [];
            await classDoc.save();

            // Note: Because we modified a class document, we should invalidate the class cache too!
            try {
                await redisClient.del(REDIS_KEYS.schoolClasses(schoolId));
            } catch (err) { /* ignore */ }
        }

        // 🌟 INVALIDATE SECTION CACHES (Both specific class AND general school)
        try {
            await redisClient.del(
                REDIS_KEYS.schoolSections(schoolId), // The "all" sections view
                REDIS_KEYS.schoolSections(schoolId, classId) // The specific class view
            );
        } catch (redisError) {
            console.error("Redis Del Error (Create Section):", redisError);
        }

        await createAuditLog(req, {
            action: "create",
            module: "section",
            targetId: newSection._id,
            description: `section created (${newSection._id})`,
            status: "success"
        });


        return res.status(201).json({ ok: true, data: newSection });

    } catch (error: any) {
        console.error("Create Section Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// 3. UPDATE SECTION
// ============================
// export const updateSection = async (req:RoleBasedRequest, res:Response) => {
//   try {
//     const { id } = req.params;
//     const { name, classTeacherId = null, roomNumber, capacity } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ ok: false, message: "Invalid Section ID" });
//     }

//     const section = await SectionModel.findById(id);
//     if (!section) {
//       return res.status(404).json({ ok: false, message: "Section not found" });
//     }

//     // 1. Duplicate Name Check (only if name changes)
//     if (name && name !== section.name) {
//       const duplicate = await SectionModel.findOne({ 
//         classId: section.classId, 
//         name: { $regex: new RegExp(`^${name}$`, "i") },
//         _id: { $ne: id } 
//       });
//       if (duplicate) {
//         return res.status(400).json({ ok: false, message: "Section name already exists in this class" });
//       }
//       section.name = name;
//     }

//     // 2. Teacher Update
//     if (classTeacherId !== undefined) {
//       if (classTeacherId) {
//         const teacher = await UserModel.findById(classTeacherId);
//         // Basic check: exists, is teacher, same school
//         if (!teacher || teacher.role.toLowerCase() !== "teacher" || teacher.schoolId.toString() !== section.schoolId.toString()) {
//            return res.status(400).json({ ok: false, message: "Invalid Teacher" });
//         }
//         section.classTeacherId = classTeacherId;
//       } else {
//         section.classTeacherId = null; // Unassign teacher
//       }
//     }

//     if (roomNumber !== undefined) section.roomNumber = roomNumber;
//     if (capacity !== undefined) section.capacity = capacity;

//     await section.save();

//     return res.status(200).json({ ok: true, data: section });

//   } catch (error:any) {
//     console.error("Update Section Error:", error);
//     return res.status(500).json({ ok: false, message: "Internal server error" });
//   }
// };


export const updateSection = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, roomNumber, capacity } = req.body;

        // 1. Prepare Update Object (Clean & Dynamic)
        const updates: any = {};
        if (name) updates.name = name.trim();
        if (roomNumber) updates.roomNumber = roomNumber;
        if (capacity) updates.capacity = capacity;

        // 2. Teacher Validation (Only runs if you are changing the teacher)
        // We cannot skip this DB call if we want to ensure the teacher is valid/secure.
        // if (classTeacherId !== undefined) {
        //     if (classTeacherId) {
        //         const teacher = await UserModel.findById(classTeacherId).select("role schoolId");

        //         // We can check the role here, but we can't check 'schoolId' match yet 
        //         // without fetching the section. 
        //         // OPTIMIZATION: We assume if the Teacher exists and is a Teacher, we proceed.
        //         // The check for "Same School" can be done by adding a filter to the Update query below.

        //         if (!teacher || teacher.role.toLowerCase() !== "teacher") {
        //             return res.status(400).json({ ok: false, message: "Invalid Teacher selected" });
        //         }
        //         updates.classTeacherId = classTeacherId;
        //     } else {
        //         updates.classTeacherId = null; // Remove teacher
        //     }
        // }


        // 3. THE MAIN OPTIMIZATION: Find & Update in ONE Shot
        // We try to update. 
        // - If ID doesn't exist? returns null.
        // - If Name is duplicate? Throws Error 11000.
        const updatedSection = await SectionModel.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedSection) {
            return res.status(404).json({ ok: false, message: "Section not found" });
        }

        // 🌟 INVALIDATE SECTION CACHES
        try {
            const schoolIdStr = updatedSection.schoolId.toString();
            const classIdStr = updatedSection.classId.toString();
            await redisClient.del(
                REDIS_KEYS.schoolSections(schoolIdStr),
                REDIS_KEYS.schoolSections(schoolIdStr, classIdStr)
            );
        } catch (redisError) {
            console.error("Redis Del Error (Update Section):", redisError);
        }

        await createAuditLog(req, {
            action: "edit",
            module: "section",
            targetId: id,
            description: `section edited (${id})`,
            status: "success"
        });

        // (Optional Security): If you updated the teacher, ensure the School IDs match.
        // Since we have the updated document now, we can check it post-update.
        // If mismatch, we revert (rare edge case, but keeps it secure with fewer initial calls).
        // if (classTeacherId && updatedSection.classTeacherId) {
        //     const teacher = await UserModel.findById(classTeacherId); // Cached from step 2 ideally
        //     if (teacher.schoolId.toString() !== updatedSection.schoolId.toString()) {
        //         // Revert the teacher assignment if schools don't match
        //         await SectionModel.findByIdAndUpdate(id, { classTeacherId: null });
        //         return res.status(403).json({ ok: false, message: "Teacher belongs to a different school" });
        //     }
        // }

        return res.status(200).json({ ok: true, data: updatedSection });

    } catch (error: any) {
        // 4. CATCH DUPLICATE ERROR HERE
        if (error.code === 11000) {
            return res.status(400).json({
                ok: false,
                message: "Section name already exists in this class"
            });
        }

        console.error("Update Section Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};


// ============================
// 4. DELETE SECTION
// ============================
export const deleteSection = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(404).json({ ok: false, message: "Id not found" });
        }

        // TODO: Check if students are enrolled in this section
        // const students = await StudentHistoryModel.findOne({ sectionId: id });
        // if(students) return res.status(400).json({message: "Cannot delete section with students"});

        const deletedSection = await SectionModel.findByIdAndDelete(id);

        if (!deletedSection) {
            return res.status(404).json({ ok: false, message: "Section not found" });
        }


        // 2. AUTO-FIX: Check if any sections remain for this class
        const remainingSectionsCount = await SectionModel.countDocuments({
            classId: deletedSection.classId
        });

        // If NO sections are left, set the Class 'hasSections' to false
        if (remainingSectionsCount === 0) {
            await ClassModel.findByIdAndUpdate(deletedSection.classId, {
                hasSections: false
            });

            // Invalidate class cache because we modified `hasSections` on the class doc
            try {
                await redisClient.del(REDIS_KEYS.schoolClasses(deletedSection.schoolId.toString()));
            } catch (err) { /* ignore */ }
        }

        // 🌟 INVALIDATE SECTION CACHES
        try {
            const schoolIdStr = deletedSection.schoolId.toString();
            const classIdStr = deletedSection.classId.toString();
            await redisClient.del(
                REDIS_KEYS.schoolSections(schoolIdStr),
                REDIS_KEYS.schoolSections(schoolIdStr, classIdStr)
            );
        } catch (redisError) {
            console.error("Redis Del Error (Delete Section):", redisError);
        }


        await archiveData({
            schoolId: deletedSection.schoolId,
            category: "section",
            originalId: deletedSection._id,
            deletedData: deletedSection.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req.user!._id || null,
            reason: null, // Optional reason from body
        });

        await createAuditLog(req, {
            action: "delete",
            module: "section",
            targetId: id,
            description: `section deleted (${id})`,
            status: "success"
        });

        return res.status(200).json({ ok: true, message: "Section deleted successfully" });
    } catch (error: any) {
        console.error("Delete Section Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};
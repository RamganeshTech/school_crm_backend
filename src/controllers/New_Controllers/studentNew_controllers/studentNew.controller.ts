
// ==========================================
// CREATE STUDENT PROFILE

import type { Response } from "express";
import StudentNewModel from "../../../models/New_Model/StudentModel/studentNew.model.js";
import UserModel from "../../../models/New_Model/UserModel/userModel.model.js";
// import { isValidPhone } from "../../../Utils/basicValidation.js";
// import { uploadImageToS3 } from "../../../Utils/s3upload.js";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";
// import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";

// ==========================================
export const createStudentProfile = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            schoolId,
            studentName,
            gender,
            dob,
            whatsappNumber,
            newOld,
            //   mandatory, 
            //   nonMandatory 
        } = req.body;

        const file = req.file; // From Multer

        // 1. PARSE NESTED OBJECTS (FormData sends them as strings)
        let mandatoryData: any = {};
        let nonMandatoryData: any = {};

        try {
            if (req.body.mandatory) {
                mandatoryData = JSON.parse(req.body.mandatory);
            }
            if (req.body.nonMandatory) {
                nonMandatoryData = JSON.parse(req.body.nonMandatory);
            }
        } catch (parseError: any) {
            return res.status(400).json({
                ok: false,
                message: "Invalid JSON format for mandatory/nonMandatory fields",
                error: parseError.message
            });
        }

        // 1. Basic Validation
        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }
        if (!studentName) {
            return res.status(400).json({ ok: false, message: "studentName is required" });
        }

        // 2. Handle Image Upload (Optional)
        let uploadedImage = null;
        if (file) {
            const uploadedData = await uploadFileToS3New(file);
            const type = file.mimetype.startsWith("image") ? "image" : "pdf";

            uploadedImage = {
                url: uploadedData.url,
                key: uploadedData.key,
                type: type,
                originalName: file.originalname,
                uploadedAt: new Date()
            };
        }

        // 3. Create Student Instance
        // Note: We do NOT pass srId here. The pre-save hook handles it.
        const newStudent = new StudentNewModel({
            schoolId,
            studentName,
            gender: gender || null,
            dob: dob || null,
            whatsappNumber: whatsappNumber || null,
            studentImage: uploadedImage,
            newOld: newOld || null,

            // Since these are objects in schema, we pass them directly
            // If frontend sends nothing, they default to empty objects per schema
            mandatory: mandatoryData || {},
            nonMandatory: nonMandatoryData || {},

            // Defaulting cache IDs to null initially
            currentClassId: null,
            currentSectionId: null,
            isActive: true
        });

        // 4. Save (Triggers Pre-Save Hook for SR-ID)
        await newStudent.save();

        // if (mandatoryData.mobileNumber) {
        //     await UserModel.findOneAndUpdate({ phoneNo: mandatoryData.mobileNumber }, {
        //         $addToSet: { studentId: newStudent._id }
        //     })

        // }

        // =========================================================
        // 6. PARENT LINKING LOGIC
        // =========================================================
        // Check if a mobile number was provided in mandatory details
        const parentMobile = mandatoryData?.mobileNumber;

        if (parentMobile) {
            console.log("333333333")
            // We use findOneAndUpdate with $addToSet
            // $addToSet: Adds the ID only if it does NOT already exist in the array.
            const updatedParent = await UserModel.findOneAndUpdate(
                {
                    phoneNo: parentMobile,
                    // role: "parent" 
                },
                {
                    $addToSet: { studentId: newStudent._id }
                },
                { new: true } // Returns the updated document (optional, for logging)
            );

            console.log("444444", updatedParent)


            if (updatedParent) {
                console.log(`[Link Success] Student ${newStudent.srId || newStudent._id} linked to Parent ${updatedParent.userName}`);
            } else {
                console.log(`[Link Info] No existing parent account found for mobile: ${parentMobile}. Link will happen when Parent registers.`);
            }
        }


        await createAuditLog(req, {
            action: "create",
            module: "student",
            targetId: newStudent._id,
            description: `student created (${newStudent._id})`,
            status: "success"
        });

        return res.status(201).json({
            ok: true,
            message: "Student profile created successfully",
            data: newStudent
        });

    } catch (error: any) {
        console.error("Create Student Profile Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};






// ==========================================
// 1. UPDATE STUDENT PROFILE
// ==========================================
export const updateStudent = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        // const updates = req.body;
        let updates = { ...req.body };
        const file = req.file;


        // // Handle Image Update
        // if (file) {
        //     const uploadedUrl = await uploadImageToS3(file);
        //     updates.studentImage = {
        //         type: "image",
        //         url: uploadedUrl,
        //         originalName: file.originalname,
        //         uploadedAt: new Date()
        //     };
        // }

        if (file) {
            const uploadedData = await uploadFileToS3New(file);
            const type = file.mimetype.startsWith("image") ? "image" : "pdf";

            updates.studentImage = {
                url: uploadedData.url,
                key: uploadedData.key,
                type: type,
                originalName: file.originalname,
                uploadedAt: new Date()
            };
        }

        try {
            if (typeof updates.mandatory === 'string') {
                updates.mandatory = JSON.parse(updates.mandatory);
            }
            if (typeof updates.nonMandatory === 'string') {
                updates.nonMandatory = JSON.parse(updates.nonMandatory);
            }
        } catch (parseError: any) {
            return res.status(400).json({
                ok: false,
                message: "Invalid JSON format for mandatory/nonMandatory fields",
                error: parseError.message
            });
        }


        // Prevent updating Immutable Fields
        if (updates.srId) delete updates.srId;
        if (updates.schoolId) delete updates.schoolId;

        // Handle Nested Objects (Mandatory/NonMandatory)
        // If you send partial data (e.g. only fatherName), we need to merge it, 
        // otherwise Mongoose might overwrite the whole object if not careful.
        // However, usually with $set and dot notation in frontend (mandatory.fatherName) it works best.
        // For simplicity here, we assume the frontend sends the structure correctly.

        const updatedStudent = await StudentNewModel.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedStudent) {
            return res.status(404).json({ ok: false, message: "Student not found" });
        }

        // Check if a mobile number was provided in mandatory details
        const parentMobile = updates.mandatory?.mobileNumber;

        if (parentMobile) {
            // console.log("5555555555")
            // We use findOneAndUpdate with $addToSet
            // $addToSet: Adds the ID only if it does NOT already exist in the array.
            const updatedParent = await UserModel.findOneAndUpdate(
                {
                    phoneNo: parentMobile,
                    // role: "parent" 
                },
                {
                    $addToSet: { studentId: updatedStudent._id }
                },
                { new: true } // Returns the updated document (optional, for logging)
            );

            // console.log("66666666666", updatedParent)


            if (updatedParent) {
                console.log(`[Link Success] Student ${updatedStudent.srId || updatedStudent._id} linked to Parent ${updatedParent.userName}`);
            } else {
                console.log(`[Link Info] No existing parent account found for mobile: ${parentMobile}. Link will happen when Parent registers.`);
            }
        }

        await createAuditLog(req, {
            action: "edit",
            module: "student",
            targetId: updatedStudent._id,
            description: `student updated (${updatedStudent._id})`,
            status: "success"
        });


        return res.status(200).json({
            ok: true,
            message: "Student updated successfully",
            data: updatedStudent
        });

    } catch (error: any) {
        console.error("Update Student Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};

// ==========================================
// 2. DELETE STUDENT PROFILE
// ==========================================
export const deleteStudent = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const deletedStudent = await StudentNewModel.findByIdAndDelete(id);

        if (!deletedStudent) {
            return res.status(404).json({ ok: false, message: "Student not found" });
        }


        // 2. CALL THE ARCHIVE UTILITY
        await archiveData({
            schoolId: deletedStudent?.schoolId,
            category: "student",
            originalId: deletedStudent._id,
            deletedData: deletedStudent.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req.user!._id || null,
            reason: null, // Optional reason from body
        });


        await createAuditLog(req, {
            action: "delete",
            module: "student",
            targetId: id,
            description: `student deleted (soft delete) (${id})`,
            status: "success"
        });

        // TODO: Ideally, you should also delete related FeeRecords here to clean up.
        // await StudentRecordModel.deleteMany({ studentId: id });

        return res.status(200).json({
            ok: true,
            message: "Student profile deleted successfully"
        });

    } catch (error: any) {
        console.error("Delete Student Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};

// ==========================================
// 3. GET SINGLE STUDENT BY ID
// ==========================================
export const getStudentById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const student = await StudentNewModel.findById(id)
            .populate("currentClassId", "name _id")   // Populate Class Name
            .populate("currentSectionId", "name _id"); // Populate Section Name

        if (!student) {
            return res.status(404).json({ ok: false, message: "Student not found" });
        }

        return res.status(200).json({
            ok: true,
            data: student
        });

    } catch (error: any) {
        console.error("Get Student Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};

// ==========================================
// 4. GET ALL STUDENTS (School / Class / Section) + PAGINATION
// ==========================================
export const getAllStudents = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            schoolId,
            classId,
            sectionId,
            page = 1,
            limit = 10,
            search // Optional search by name/srId
        } = req.query;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        // Build Filter
        const filter:any = { schoolId };

        if (classId) filter.currentClassId = classId;
        if (sectionId) filter.currentSectionId = sectionId;

        // Search Logic (Name OR SR-ID)
        if (search) {
            filter.$or = [
                { studentName: { $regex: search, $options: "i" } },
                { srId: { $regex: search, $options: "i" } }
            ];
        }

        // Pagination Calculation
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Execute Query
        const students = await StudentNewModel.find(filter)
            .select("-__v") // Exclude internal version
            .populate("currentClassId", "name")
            .populate("currentSectionId", "name")
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limitNum);

        // Get Total Count (for frontend pagination)
        const total = await StudentNewModel.countDocuments(filter);

        return res.status(200).json({
            ok: true,
            data: students,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNum),
                currentPage: pageNum,
                pageSize: limitNum
            }
        });

    } catch (error: any) {
        console.error("Get All Students Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};





export const assignStudentToParent = async (req: RoleBasedRequest, res: Response) => {
    try {


        const { parentId, studentId } = req.body


        // Validate required fields
        if (!parentId) {
            return res.status(400).json({ ok: false, message: "parentId is required" });
        }

        if (!studentId) {
            return res.status(400).json({ ok: false, message: "studentId is required" });

        }


        console.log("5555555555")
        // We use findOneAndUpdate with $addToSet
        // $addToSet: Adds the ID only if it does NOT already exist in the array.
        const updatedParent = await UserModel.findByIdAndUpdate(
            parentId,
            {
                $addToSet: { studentId: studentId }
            },
            { new: true } // Returns the updated document (optional, for logging)
        ).select("-password")

        // 3. Handle "Parent Not Found" Case
        if (!updatedParent) {
            return res.status(404).json({
                ok: false,
                message: "No user found with this parentId."
            });
        }

        await createAuditLog(req, {
            action: "edit",
            module: "user",
            targetId: parentId,
            description: `student assinged to parent user (${parentId})`,
            status: "success"
        });

        console.log("66666666666", updatedParent)

        res.status(200).json({ ok: true, data: updatedParent, message: `Link Success, Student linked to Parent ${updatedParent.userName}` });
    } catch (error: any) {
        console.error("assing Students Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });

    }
}

export const removeStudentFromParent = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { parentId, studentId } = req.body;

        // 1. Validate required fields
        if (!parentId) {
            return res.status(400).json({ ok: false, message: "parentId is required" });
        }

        if (!studentId) {
            return res.status(400).json({ ok: false, message: "studentId is required" });
        }

        // 2. Database Operation: REMOVE the ID
        // $pull: Removes all instances of a value from an existing array.
        const updatedParent = await UserModel.findByIdAndUpdate(
            parentId,
            {
                $pull: { studentId: studentId } // <--- THIS IS THE KEY CHANGE
                // $pull: { studentId: new mongoose.Types.ObjectId(studentId) } 

            },
            { new: true } // Returns the updated document
        ).select("-password");

        // 3. Handle "Parent Not Found" Case
        if (!updatedParent) {
            return res.status(404).json({
                ok: false,
                message: "No user found with this mobile number."
            });
        }

        await createAuditLog(req, {
            action: "edit",
            module: "user",
            targetId: parentId,
            description: `student removed from parent user (${parentId})`,
            status: "success"
        });


        console.log("Student Removed. Updated Parent:", updatedParent);

        return res.status(200).json({
            ok: true,
            data: updatedParent,
            message: `Unlink Success. Student removed from Parent ${updatedParent.userName}`
        });

    } catch (error: any) {
        console.error("Remove Student Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};
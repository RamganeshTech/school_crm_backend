import mongoose from "mongoose";
import UserModel from "../../../models/New_Model/UserModel/userModel.model.js";
import type { Request, Response } from "express";

export const getUsersBySchool = async (req: Request, res: Response): Promise<any> => {
    try {
        // 1. Get School ID
        // If the user is logged in (Principal/Admin), use their schoolId.
        // If a Platform Admin is querying, they might pass it in query params.
        const schoolId = req.params.schoolId!

        const role = req.params.role as string

        const allowedRoles = ["correspondent", "teacher", "principal", "viceprincipal", "administrator", "parent", "accountant"]
        // if (role === "all") {

        //     if (!allowedRoles.includes(role)) {
        //         return res.status(400).json({ ok: false, message: `role not allowed, only ${allowedRoles.join(", ")} are allowed` });
        //     }
        // }


        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "School ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(schoolId as string)) {
            return res.status(400).json({ ok: false, message: "Invalid School ID format" });
        }

        // 2. Build the Query Object


        if (role === "all") {
            // LOGIC: If "all", find users whose role matches ANY of the allowed roles
            // We use case-insensitive Regex for every role in the list to be safe
            //   const regexRoles = allowedRoles.map(r => new RegExp(`^${r}$`, "i"));

            const users = await UserModel.find({
                schoolId: schoolId,
            })
                .select("-password -__v") // Exclude password and internal version key
                .populate({
                    path: "assignments.classId", // 1. Populate Class
                    select: "name _id"           // Only get Name and ID
                })
                .populate({
                    path: "assignments.sectionId", // 2. Populate Section
                    select: "name _id"             // Only get Name and ID
                })
                .sort({ userName: 1 });   // Sort alphabetically by name

            return res.status(200).json({
                ok: true,
                count: users.length,
                data: users,
            });


        }



        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ ok: false, message: `role not allowed, only ${allowedRoles.join(", ")} and "all" are allowed` });
        }

        // 2. Query
        const users = await UserModel.find({
            schoolId: schoolId,
            role: role,
        })
            .select("-password -__v") // Exclude password and internal version key
            .populate({
                path: "assignments.classId", // 1. Populate Class
                select: "name _id"           // Only get Name and ID
            })
            .populate({
                path: "assignments.sectionId", // 2. Populate Section
                select: "name _id"             // Only get Name and ID
            })
            .sort({ userName: 1 });   // Sort alphabetically by name

        return res.status(200).json({
            ok: true,
            count: users.length,
            data: users,
        });

    } catch (error: any) {
        console.error("Get users Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};



export const getSingleUser = async (req: Request, res: Response): Promise<any> => {
    try {
        // 1. Get School ID
        // If the user is logged in (Principal/Admin), use their schoolId.
        // If a Platform Admin is querying, they might pass it in query params.
        const userId = req.params.userId



        if (!userId) {
            return res.status(400).json({ ok: false, message: "user ID is required" });
        }


        // 2. Query
        const user = await UserModel.findById(userId)
            .select("-password -__v") // Exclude password and internal version key
            .populate({ path: "schoolId", select: "_id name currentAcademicYear address phoneNo logo" })
            .populate({
                path: "assignments.classId", // 1. Populate Class
                select: "name _id"           // Only get Name and ID
            })
            .populate({
                path: "assignments.sectionId", // 2. Populate Section
                select: "name _id"             // Only get Name and ID
            })
            .populate({
                path: "studentId"
            });

        return res.status(200).json({
            ok: true,
            data: user,
        });

    } catch (error: any) {
        console.error("Get user Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};

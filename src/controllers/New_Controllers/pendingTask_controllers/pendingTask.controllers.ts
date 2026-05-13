// import StudentNewModel from "../models/StudentNewModel.js";
// import UserModel from "../models/UserModel.js";

import type { Response } from "express";
import HomeworkModel from "../../../models/New_Model/HomeWork_model/HomeWork.model.js";
import HomeWorkSubmissionModel from "../../../models/New_Model/HomeWork_model/HomeWorkSubmission.model.js";
import StudentNewModel from "../../../models/New_Model/StudentModel/studentNew.model.js";
import UserModel from "../../../models/New_Model/UserModel/userModel.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";

export const getPendingTasksForParent = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.user!;
        const { role, userId } = req.query;

        // if (role !== "parent") {
        //     return res.status(200).json({
        //         ok: true,
        //         totalPending: 0,
        //         data: [],
        //         message: "Pending tasks are currently only for parent roles."
        //     });
        // }


        if (!userId) {
            return res.status(400).json({ message: "userId is required", ok: false })
        }

        console.log("role", role)

        // 1. Get associated student IDs
        const parentUser = await UserModel.findById(userId).select("studentId");
        if (!parentUser || !parentUser.studentId?.length) {
            return res.status(200).json({ ok: true, totalPending: 0, data: [] });
        }

        const studentData = await StudentNewModel.find({
            _id: { $in: parentUser.studentId },
            schoolId: schoolId
        });

        // 2. Setup Date for Today (Start and End of day for query)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const pendingTasks = [];

        // 3. Iterate through each student to check Profile and Homework
        for (const student of studentData) {
            let studentHasProfileIssue = false;
            let studentHasHomeworkIssue = false;

            // --- A. CHECK PROFILE INFO ---
            const hasEmptyFields = (obj: any) => {
                if (!obj) return true;
                const values = obj.toObject ? Object.values(obj.toObject()) : Object.values(obj);
                return values.some(v => v === null || v === undefined || v === "");
            };

            if (hasEmptyFields(student.mandatory) || hasEmptyFields(student.nonMandatory)) {
                studentHasProfileIssue = true;
            }

            // --- B. CHECK TODAY'S HOMEWORK ---
            // Find homework for this student's class/section for TODAY
            const todaysHomework = await HomeworkModel.findOne({
                schoolId: schoolId,
                classId: student.currentClassId,
                $or: [
                    { sectionId: student.currentSectionId },
                    { sectionId: null } // Handle case where homework is for all sections
                ],
                homeworkDate: { $gte: todayStart, $lte: todayEnd }
            });

            if (todaysHomework && todaysHomework.subjects?.length > 0) {
                // Get all submissions by this student for this specific homework document
                const submissions = await HomeWorkSubmissionModel.find({
                    studentId: student._id,
                    homeworkId: todaysHomework._id
                });

                // If number of submissions is less than number of subjects assigned, it's pending
                if (submissions.length < todaysHomework.subjects.length) {
                    studentHasHomeworkIssue = true;
                }
            }

            // --- 4. PUSH TO RESULTS ---
            // Profile Task
            if (studentHasProfileIssue) {
                pendingTasks.push({
                    id: student._id,
                    name: student.studentName,
                    module: "studentProfile",
                    message: `Complete ${student.studentName}'s profile information.`
                });
            }

            // Homework Task (Counted as 1 even if 5 subjects are missing)
            if (studentHasHomeworkIssue) {
                pendingTasks.push({
                    id: student._id,
                    homeworkId: (todaysHomework as any)._id,
                    name: student.studentName,
                    module: "homeworkSubmission",
                    message: `Pending homework subjects for ${student.studentName} today.`
                });
            }
        }

        return res.status(200).json({
            ok: true,
            totalPending: pendingTasks.length,
            data: pendingTasks,
            message: "Pending tasks fetched successfully"
        });

    } catch (error: any) {
        console.error("Pending Tasks Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};
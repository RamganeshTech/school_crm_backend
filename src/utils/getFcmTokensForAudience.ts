// utils/getFcmTokensForAudience.ts
import { Types } from 'mongoose';
import UserModel from '../models/New_Model/UserModel/userModel.model.js';
import StudentNewModel from '../models/New_Model/StudentModel/studentNew.model.js';

interface AudienceParams {
    schoolId: string;
    targetAudience: 'all' | 'parent' | 'teacher' | 'specific_classes';
    targetClasses?: string[] | undefined;
    targetSections?: string[] | undefined;
    targetStudents?: string[] | undefined;
}

export const getFcmTokensForAudience = async (params: AudienceParams): Promise<string[]> => {
    const { schoolId, targetAudience, targetClasses, targetSections, targetStudents } = params;

    let userIds: Types.ObjectId[] = [];

    if (targetStudents && targetStudents.length > 0) {
        // Attendance-style: specific students → find their parent(s)
        const parents = await UserModel.find({
            schoolId,
            role: 'parent',
            linkedStudentIds: { $in: targetStudents },
        }).select('_id');
        userIds = parents.map((p) => p._id);
    } else if (targetAudience === 'parent' && (targetClasses?.length || targetSections?.length)) {
        // Homework-style: class/section-wide → find students in that class, then their parents
        const studentFilter: any = { schoolId };
        if (targetClasses?.length) studentFilter.currentClassId = { $in: targetClasses };
        if (targetSections?.length) studentFilter.currentSectionId = { $in: targetSections };

        const students = await StudentNewModel.find(studentFilter).select('_id');
        const studentIds = students.map((s) => s._id);

        const parents = await UserModel.find({
            schoolId,
            role: 'parent',
            linkedStudentIds: { $in: studentIds },
        }).select('_id');
        userIds = parents.map((p) => p._id);
    } else if (targetAudience === 'all') {
        const users = await UserModel.find({ schoolId }).select('_id');
        userIds = users.map((u) => u._id);
    } else {
        // 'parent' or 'teacher' with no class/section filter → every user of that role in the school
        const users = await UserModel.find({ schoolId, role: targetAudience }).select('_id');
        userIds = users.map((u) => u._id);
    }

    const usersWithTokens = await UserModel.find({ _id: { $in: userIds } }).select('fcmTokens');

    const tokens = usersWithTokens.flatMap((u: any) => u.fcmTokens || []);
    return [...new Set(tokens)]; // dedupe
};
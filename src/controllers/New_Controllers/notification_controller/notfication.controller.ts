// controllers/notification/notificationController.ts
import { type Response } from 'express';
import { Types } from 'mongoose';
import type { RoleBasedRequest } from '../../../utils/types.js';
import NotificationModel from '../../../models/New_Model/notification_model/notification.model.js';
import type { IUserRole } from '../../../models/New_Model/UserModel/userModel.model.js';
import { messaging } from '../../../config/firebaseAdmin.js';
import { getFcmTokensForAudience } from '../../../utils/getFcmTokensForAudience.js';

// Roles allowed to create notifications — same staff set used elsewhere, parents never create these
const CREATOR_ROLES: IUserRole[] = ['correspondent', 'principal', 'viceprincipal', 'teacher', 'administrator'];

// Maps a logged-in user's role to which targetAudience values they should see.
// NOTE: this does not yet handle 'specific_classes' matching against the user's actual
// classId/sectionId (parents/teachers) — same gap likely exists on the Announcement side.
// Flag if you want that added; needs classId/sectionId on the payload or a lookup.
const audienceValuesForRole = (role: string): string[] => {
    if (role === 'parent') return ['all', 'parent'];
    if (role === 'teacher') return ['all', 'teacher'];
    // correspondent/principal/viceprincipal/administrator see everything
    return ['all', 'parent', 'teacher', 'specific_classes'];
};

// types/notification.ts
export interface CreateNotificationPayload {
    type?: 'announcement' | 'homework' | 'attendance' | 'general';
    title: string;
    message: string;
    referenceId: string;
    referenceModel?: string;
    path: string;
    targetAudience: 'all' | 'parent' | 'teacher' | 'specific_classes';
    targetClasses?: string[];
    targetSections?: string[];
    targetStudents?: string[];
    academicYear?: string;
}

// --- 1. CREATE ---
// --- 1. INTERNAL HELPER: CREATE ---
export const createNotification = async (
    req: RoleBasedRequest,
    payload: CreateNotificationPayload
) => {
    try {
        const user = req.user;

        if (!user) {
            return { ok: false, message: 'Unauthorized' };
        }

        if (!CREATOR_ROLES.includes(user.role)) {
            return { ok: false, message: 'You are not permitted to create notifications' };
        }

        const {
            type,
            title,
            message,
            referenceId,
            referenceModel,
            path,
            targetAudience,
            targetClasses,
            targetStudents,
            targetSections,
            academicYear,
        } = payload;

        if (!title || !message || !referenceId || !path || !targetAudience) {
            return {
                ok: false,
                message: 'title, message, referenceId, path, and targetAudience are required',
            };
        }

        if (!Types.ObjectId.isValid(referenceId)) {
            return { ok: false, message: 'Invalid referenceId' };
        }

        const notification = await NotificationModel.create({
            schoolId: user.schoolId,
            type: type || 'announcement',
            title,
            message,
            referenceId,
            referenceModel: referenceModel || 'Announcement',
            path,
            targetAudience,
            targetClasses: targetClasses || [],
            targetSections: targetSections || [],
            targetStudents: targetStudents || [], // <--- ADD THIS LINE
            academicYear,
            createdBy: user._id,
            readBy: [],
        });

        try {
            const tokens = await getFcmTokensForAudience({
                schoolId: user.schoolId,
                targetAudience,
                targetClasses: targetClasses ?? [],
                targetSections: targetSections ?? [],
                targetStudents: targetStudents ?? [],
            });

            if (tokens.length > 0) {
                await messaging.sendEachForMulticast({
                    tokens,
                    notification: {
                        title: notification.title,
                        body: notification.message,
                    },
                    data: {
                        notificationId: notification._id.toString(),
                        referenceId: notification.referenceId.toString(),
                        referenceModel: notification.referenceModel,
                    },
                });
            }
        } catch (pushError) {
            console.error('FCM push failed, but notification was saved:', pushError);
        }

        return {
            ok: true,
            data: notification,
            message: 'Notification created successfully'
        };

    } catch (error: any) {
        console.error("Internal Notification Error:", error);
        return {
            ok: false,
            message: error.message || 'Failed to create notification internally'
        };
    }
};

// --- 2. GET ALL (role-filtered, paginated, with isRead computed per user) ---
export const getAllNotifications = async (req: RoleBasedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ ok: false, message: 'Unauthorized' });
        }

        // const page = Math.max(Number(req.query.page) || 1, 1);
        // const limit = Math.max(Number(req.query.limit) || 10, 1);
        // const skip = (page - 1) * limit;

        const audienceValues = audienceValuesForRole(user.role);
        const unreadOnly = true;


        const filter = {
            schoolId: user.schoolId,
            targetAudience: { $in: audienceValues },
            'readBy.userId': { $ne: new Types.ObjectId(user._id) },

        };



        // if (unreadOnly) {
        //     filter['readBy.userId'] = { $ne: new Types.ObjectId(user._id) };
        // }

        // const [notifications, total] = await Promise.all([
        //     NotificationModel.find(filter)
        //         .sort({ createdAt: -1 })
        //         // .skip(skip)
        //         // .limit(limit)
        //         .lean(),
        //     NotificationModel.countDocuments(filter),
        // ]);

        const notifications = await NotificationModel.find(filter)
            .sort({ createdAt: -1 })
            .lean();


        // Attach isRead per current user without exposing the full readBy array to the client
        const data = notifications.map((n: any) => ({
            ...n,
            // isRead: (n.readBy || []).some((r: any) => r.userId?.toString() === user._id),
            isRead: false, // always false here since the query already excludes read ones
            readBy: undefined,
        }));

        // const totalPages = Math.ceil(total / limit) || 1;

        return res.status(200).json({
            ok: true,
            data,
            // pagination: {
            //     total,
            //     page,
            //     totalPages,
            //     limit,
            // },
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message || 'Failed to fetch notifications' });
    }
};

// --- 3. GET SINGLE (auto-marks as read for the requesting user) ---
export const getSingleNotification = async (req: RoleBasedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ ok: false, message: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: 'Invalid notification id' });
        }

        const notification = await NotificationModel.findOne({ _id: id, schoolId: user.schoolId });
        if (!notification) {
            return res.status(404).json({ ok: false, message: 'Notification not found' });
        }

        const alreadyRead = notification.readBy.some((r) => r.userId.toString() === user._id);

        if (!alreadyRead) {
            // $addToSet-style guard via the alreadyRead check above avoids duplicate readBy entries
            notification.readBy.push({
                userId: new Types.ObjectId(user._id),
                readAt: new Date(),
            });
            await notification.save();
        }

        return res.status(200).json({ ok: true, data: notification });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message || 'Failed to fetch notification' });
    }
};

// --- 4. DELETE ---
export const deleteNotification = async (req: RoleBasedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ ok: false, message: 'Unauthorized' });
        }

        if (!CREATOR_ROLES.includes(user.role)) {
            return res.status(403).json({ ok: false, message: 'You are not permitted to delete notifications' });
        }

        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: 'Invalid notification id' });
        }

        const deleted = await NotificationModel.findOneAndDelete({ _id: id, schoolId: user.schoolId });
        if (!deleted) {
            return res.status(404).json({ ok: false, message: 'Notification not found' });
        }

        return res.status(200).json({ ok: true, message: 'Notification deleted successfully' });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message || 'Failed to delete notification' });
    }
};


// --- 5. MARK ALL AS READ (bulk) ---
export const markAllNotificationsAsRead = async (req: RoleBasedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ ok: false, message: 'Unauthorized' });
        }

        const audienceValues = audienceValuesForRole(user.role);

        const filter = {
            schoolId: user.schoolId,
            targetAudience: { $in: audienceValues },
            'readBy.userId': { $ne: new Types.ObjectId(user._id) }, // only touch docs this user hasn't read
        };

        const result = await NotificationModel.updateMany(filter, {
            $push: { readBy: { userId: new Types.ObjectId(user._id), readAt: new Date() } },
        });

        return res.status(200).json({
            ok: true,
            message: 'All notifications marked as read',
            modifiedCount: result.modifiedCount,
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message || 'Failed to mark notifications as read' });
    }
};


// controllers/notification/notificationController.ts

// --- MARK SINGLE AS READ ---
export const markNotificationAsRead = async (req: RoleBasedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ ok: false, message: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: 'Invalid notification id' });
        }

        const notification = await NotificationModel.findOne({ _id: id, schoolId: user.schoolId });
        if (!notification) {
            return res.status(404).json({ ok: false, message: 'Notification not found' });
        }

        const alreadyRead = notification.readBy.some((r) => r.userId.toString() === user._id);

        if (!alreadyRead) {
            notification.readBy.push({
                userId: new Types.ObjectId(user._id),
                readAt: new Date(),
            });
            await notification.save();
        }

        return res.status(200).json({ ok: true, message: 'Marked as read' });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message || 'Failed to mark notification as read' });
    }
};


// controllers/notification/notificationController.ts

// --- GET UNREAD COUNT ---
export const getUnreadNotificationCount = async (req: RoleBasedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ ok: false, message: 'Unauthorized' });
        }

        const audienceValues = audienceValuesForRole(user.role);

        const count = await NotificationModel.countDocuments({
            schoolId: user.schoolId,
            targetAudience: { $in: audienceValues },
            'readBy.userId': { $ne: new Types.ObjectId(user._id) },
        });

        return res.status(200).json({ ok: true, data: { count } });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message || 'Failed to get unread count' });
    }
};
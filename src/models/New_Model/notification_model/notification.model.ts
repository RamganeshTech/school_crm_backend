// models/notification/NotificationModel.ts
import { Schema, model, Types, Document } from 'mongoose';

export interface IReadEntry {
    userId: Types.ObjectId;
    readAt: Date;
}

export interface INotification extends Document {
    schoolId: Types.ObjectId;
    type: 'announcement' | 'homework' | 'attendance' | 'general';
    title: string;
    message: string;

    // Links back to the source document (e.g. the Announcement _id)
    referenceId: Types.ObjectId;
    referenceModel: string; // e.g. 'Announcement' — lets you populate dynamically later if needed

    // Frontend route to navigate to when this notification is clicked
    path: string;

    // Mirrors Announcement's targeting so the notification reaches the right roles
    targetAudience: 'all' | 'parent' | 'teacher' | 'specific_classes';
    targetClasses?: Types.ObjectId[];
    targetSections?: Types.ObjectId[];

    academicYear?: string;

    createdBy: Types.ObjectId;

    // Per-user read tracking — avoids fan-out while still supporting "mark as read" per user
    readBy: IReadEntry[];

    createdAt: Date;
    updatedAt: Date;
}

const ReadEntrySchema = new Schema<IReadEntry>(
    {
        userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
        readAt: { type: Date, required: true, default: Date.now },
    },
    { _id: false }
);

const NotificationSchema = new Schema<INotification>(
    {
        schoolId: { type: Schema.Types.ObjectId, required: true, ref: 'School' },

        type: {
            type: String,
            enum: ['announcement', 'homework', 'attendance', 'general'],
            required: true,
            default: 'announcement',
        },

        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },

        referenceId: { type: Schema.Types.ObjectId, required: true,  refPath:"referenceModel"},
        referenceModel: { type: String, required: true, default: 'AnnouncementModel' },

        path: { type: String, required: true },

        targetAudience: {
            type: String,
            enum: ['all', 'parent', 'teacher', 'specific_classes'],
            required: true,
            default: 'all',
        },
        targetClasses: [{ type: Schema.Types.ObjectId, ref: 'Class' }],
        targetSections: [{ type: Schema.Types.ObjectId, ref: 'Section' }],

        academicYear: { type: String },

        createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },

        readBy: { type: [ReadEntrySchema], default: [] },
    },
    { timestamps: true }
);

// schoolId indexed (not unique) — every query here is schoolId-scoped, matches your existing pattern
NotificationSchema.index({ schoolId: 1 });

// Speeds up "recent notifications for this school" listing/polling
// NotificationSchema.index({ schoolId: 1, createdAt: -1 });

// Speeds up unread-count checks against readBy.userId within a school
// NotificationSchema.index({ schoolId: 1, 'readBy.userId': 1 });

const NotificationModel = model<INotification>('NotificationModel', NotificationSchema);
export default NotificationModel;
import mongoose, {Schema, Document, Types } from "mongoose";




// Interface for the Attachments (Upload Schema)
export interface IUpload {
    type: "image" | "pdf" | "video";
    key: string;
    url: string;
    originalName?: string;
    uploadedAt: Date;
}

// Interface for the Announcement Document
export interface IAnnouncement extends Document {
    schoolId: Types.ObjectId;
    academicYear: string;
    title: string;
    description: string;
    type: string; // e.g., "announcement", "notice"
    priority: string; // e.g., "high", "normal"
    targetAudience: string[];
    targetClasses: Types.ObjectId[];
    attachments: IUpload[];
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

// Reuse your existing Upload Schema
const uploadSchema = new Schema<IUpload>({
    type: { type: String, enum: ["image", "pdf", "video"] },
    key: { type: String, required: true },
    url: { type: String, required: true },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, {_id:true});

const announcementSchema = new Schema<IAnnouncement>(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SchoolModel",
        },
        academicYear: { type: String }, // For filtering history

        // --- CONTENT ---
        title: { type: String,  },
        description: { type: String, }, // The message body
        
        type: { 
            type: String, 
            // enum: ["announcement", "notice", "circular"], 
            // default: "announcement" 
        },

        priority: {
            type: String,
            // enum: ["high", "normal"],
            // default: "normal" // High priority might show red in UI
        },

        // --- TARGET AUDIENCE ---
        targetAudience: {
            type: [String],
            // enum: ["ALL", "STAFF", "STUDENTS", "PARENTS", "SPECIFIC_CLASSES"],
            // required: true
            default:["all"]
        },

        // Only used if targetAudience === "SPECIFIC_CLASSES"
        targetClasses: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassModel"
        }],

        // --- ATTACHMENTS ---
        attachments: {
            type: [uploadSchema],
            default: []
        },

        // --- META DATA ---
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel",
            // required: true
        },
        
        // Allows scheduling (e.g., create now, show Monday)
        // publishDate: { type: Date, default: () => Date.now() },
        
        // // Optional: Auto-hide after this date
        // expiryDate: { type: Date } 
    },
    { timestamps: true }
);

// Indexes for fast fetching by parents/students
// announcementSchema.index({ schoolId: 1, targetAudience: 1, publishDate: -1 });
announcementSchema.index({schoolId:1, academicYear:1});

export const AnnouncementModel = mongoose.model("AnnouncementModel", announcementSchema);
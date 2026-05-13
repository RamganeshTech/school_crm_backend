import mongoose, { Schema, Document, Types } from "mongoose";

// 1. Reusable Upload Interface
export interface ISubmissionUpload {
    _id?: Types.ObjectId;
    type: "image" | "pdf";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

// 2. Main Homework Submission Interface
export interface IHomeworkSubmission extends Document {
    schoolId: Types.ObjectId | null;
    academicYear: string | null;
    homeworkId: Types.ObjectId;
    subjectId?: Types.ObjectId; // Links to the specific subject entry in the homework
    studentId: Types.ObjectId;
    status: "pending" | "completed";
    completedAt: Date;
    remarks?: string | null;
    studentAttachments?: ISubmissionUpload[];
    createdAt: Date;
    updatedAt: Date;
}

export const uploadSchema = new Schema<ISubmissionUpload>({
    type: { type: String, enum: ["image", "pdf"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, { _id: true });

const homeworkSubmissionSchema = new mongoose.Schema<IHomeworkSubmission>({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SchoolModel",
        default: null
    },
    academicYear: {
        type: String, // e.g., "2025-2026"
        default: null
    },
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: "HomeWorkModel", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId }, // Reference the specific subject in the subjects array
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentNewModel", required: true },
    status: { type: String, enum: ["pending", "completed"], default: "completed" },
    completedAt: { type: Date, default: new Date() },
    remarks: { type: String, default: null }, // Teacher's feedback
    // studentAttachments: [uploadSchema] // Proof of work
}, { timestamps: true });

// Index for fast lookups
homeworkSubmissionSchema.index({ homeworkId: 1, schoolId: 1 });

const HomeWorkSubmissionModel = mongoose.model("HomeWorkSubmissionModel", homeworkSubmissionSchema);

export default HomeWorkSubmissionModel;
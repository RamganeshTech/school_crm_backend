import mongoose, { Schema, Document, Types } from "mongoose";

// 1. Reusable Upload Interface
export interface IHomeworkUpload {
    _id?: Types.ObjectId;
    type: "image" | "pdf";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

// 2. Interface for individual subject homework
export interface ISubjectHomework {
    _id?: Types.ObjectId;
    subjectName: string;
    teacherId: Types.ObjectId | null;
    description: string;
    attachments: IHomeworkUpload[];
    updatedAt: Date;
}

// 3. Main Homework Document Interface
export interface IHomework extends Document {
    schoolId: Types.ObjectId | null;
    academicYear: string | null;
    classId: Types.ObjectId | null;
    sectionId: Types.ObjectId | null;
    homeworkDate: Date;
    subjects: ISubjectHomework[];
    createdAt: Date;
    updatedAt: Date;
}

export const uploadSchema = new Schema<IHomeworkUpload>({
    type: { type: String, enum: ["image", "pdf"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, {_id:true});


const homeworkSchema = new mongoose.Schema<IHomework>(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SchoolModel",
            default: null
        },
        academicYear: {
            type: String, // e.g., "2025-2026"
            default: null
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassModel",
            default: null
        },
        sectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SectionModel",
            default: null, // If null, it's for all sections
        },
        homeworkDate: {
            type: Date,
            default: new Date(),
        },
        // Array of homework for different subjects for THIS specific day
        subjects: [
            {
                subjectName: { type: String, },
                teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "UserModel", default: null },
                description: { type: String, },
                attachments: { type: [uploadSchema] },
                updatedAt: { type: Date, default: new Date() },
            },
        ],
    },
    { timestamps: true }
);

// Compound Index: Ensures we can quickly find a specific day's work for a class
homeworkSchema.index({ schoolId: 1, classId: 1, sectionId: 1, homeworkDate: -1 });

const HomeworkModel = mongoose.model("HomeWorkModel", homeworkSchema);

export default HomeworkModel;
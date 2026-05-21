import mongoose, { Schema, Document, Types, model } from "mongoose";

// 1. Individual Subject Marks Interface
export interface IMarkSubject {
    _id?: Types.ObjectId;
    subject: string;
    marksObtained: number;
    maxMarks: number;
    minPassingMarks: number;
    grade?: string | null;
}

// 2. NEW: Exam Record Interface (This represents one Column in your UI)
export interface IExamRecord {
    _id?: Types.ObjectId;
    examName: string;          // Must match the config examName (e.g., "1st Mid Term")
    subjects: IMarkSubject[];  // The marks for this specific exam
    remarks: string;           // e.g., "Good performance this term"
    isAbsent: boolean;
}

// 2. Main Mark Report Interface
export interface IMarkReport extends Document {
    schoolId: Types.ObjectId;
    academicYear: string;
    classId: Types.ObjectId | null;
    markReportConfigId?: Types.ObjectId | null;
    sectionId: Types.ObjectId | null;
    studentId: Types.ObjectId;
    subjects: IMarkSubject[];
    remarks: string;
    isAbsent: boolean;
    examRecords: IExamRecord[];
    recordedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const subjectSchema = new Schema<IMarkSubject>({
    subject: { type: String, },
    //   examId: { type: Schema.Types.ObjectId, ref: "ExamModel", required: true }, // e.g., "Unit Test 1", "Finals"

    // === DATA ===
    marksObtained: { type: Number, default: null },
    maxMarks: { type: Number, default: 100 },
    minPassingMarks: { type: Number, default: 35 },

    grade: { type: String, default: null }, // A, B, C, etc.
}, { _id: true })

// NEW: The wrapper for a specific exam
const examRecordSchema = new Schema<IExamRecord>({
    examName: { type: String, required: true },
    subjects: { type: [subjectSchema], default: [] },
    remarks: { type: String, default: "" },
    isAbsent: { type: Boolean, default: false }
}, { _id: true });

const markReportSchema = new Schema<IMarkReport>({
    // === TENANCY & TIME ===
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    academicYear: { type: String, required: true }, // e.g., "2025-2026"
    markReportConfigId: { type: Schema.Types.ObjectId, ref: "MarkReportConfigModel", default:null  }, // e.g., "2025-2026"

    // === HIERARCHY ===
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", default:null },
    sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel", default: null },

    // === THE TARGETS ===
    studentId: { type: Schema.Types.ObjectId, ref: "StudentNewModel", required: true },

    subjects: { type: [subjectSchema], default: [] },

    examRecords: { type: [examRecordSchema], default: [] },

    remarks: { type: String, default: "" },

    isAbsent: { type: Boolean, default: false },

    // === METADATA ===
    recordedBy: { type: Schema.Types.ObjectId, ref: "UserModel" }, // The teacher who entered the marks
}, { timestamps: true });

// CRITICAL FOR SCALABILITY: COMPOUND INDEXES
// This allows you to quickly find "All marks for a student" OR "All marks for a specific exam in a class"
markReportSchema.index({ schoolId: 1, academicYear: 1, classId: 1, studentId: 1 });

const MarkReportModel = model("MarkReportModel", markReportSchema);

export default MarkReportModel;
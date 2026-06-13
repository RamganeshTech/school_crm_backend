import mongoose, { Schema, Document, Types, model } from "mongoose";

// 1. Reusable Upload Interface
export interface IRecordUpload {
    type: "image" | "pdf";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

// 2. Financial Components (Used for both Targets and Paid)
export interface IFeeData {
    admissionFee: number;
    firstTermAmt: number;
    secondTermAmt: number;
    busFirstTermAmt: number;
    busSecondTermAmt: number;
}

// 3. Concession/Discount Interface
export interface IConcession {
    isApplied: boolean;
    type: "percentage" | "amount" | null;
    value: number;
    inAmount: number;
    remark?: string;
    proof?: IRecordUpload | null;
    approvedBy?: Types.ObjectId | null;
}

// 4. Main Student Record Interface
export interface IStudentRecord extends Document {
    schoolId: Types.ObjectId | null;
    studentId: Types.ObjectId | null;
    studentName?: string;
    academicYear: string;
    classId: Types.ObjectId | null;
    sectionId: Types.ObjectId | null;
    className?: string | null;
    sectionName?: string | null;
    newOld?: string; // "New" | "Old"
    rollNumber?: string | null;
    feeStructure: IFeeData;
    feePaid: IFeeData;

    feeStructurev1: Map<string, number>;
    feePaidv1: Map<string, number>;
    duesv1: Map<string, number>;

    // feePaid: IFeeData;
    concession: IConcession;
    dues: {
        admissionDues: number | null;
        firstTermDues: number | null;
        secondTermDues: number | null;
        busfirstTermDues: number | null;
        busSecondTermDues: number | null;
    };
    isActive: boolean;
    isBusApplicable: boolean;
    isFullyPaid: boolean;
    busPoint?: string | null;
    createdAt: Date;
    updatedAt: Date;
}


const uploadSchema = new Schema<IRecordUpload>({
    type: { type: String, enum: ["image", "pdf"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
});



const StudentRecordSchema = new mongoose.Schema<IStudentRecord>({
    // === REFERENCES ===
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolModel", default: null },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentNewModel", default: null },
    studentName: { type: String, default: null },

    // === TIME CONTEXT (The Critical Field) ===
    academicYear: { type: String, required: true }, // e.g., "2025-2026"

    // === LOCATION CONTEXT (For THIS Year) ===
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassModel", default: null },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "SectionModel", default: null },

    // Storing Names as Strings too (for Reporting speed/Legacy support)
    className: { type: String, default: null }, // "10" or "LKG"
    sectionName: { type: String, default: null }, // "A" or "N/A"

    // === ENROLLMENT STATUS ===
    newOld: { type: String, }, // "New" or "Old" (Specific to this year)
    rollNumber: { type: String, default: null },

    // === FINANCIALS: FEE STRUCTURE (Targets) ===
    feeStructure: {
        admissionFee: { type: Number, default: 0 },
        firstTermAmt: { type: Number, default: 0 },
        secondTermAmt: { type: Number, default: 0 },
        busFirstTermAmt: { type: Number, default: 0 },
        busSecondTermAmt: { type: Number, default: 0 },
    },

    // === FINANCIALS: FEE STRUCTURE (Targets) ===
    feeStructurev1: {
        type: Map,
        of: Number,
        default: {},
    },

    // === 2. FEE PAID (The Actuals / Collected So Far) ===
    // This increases every time a receipt is generated via FIFO
    feePaid: {
        admissionFee: { type: Number, default: 0 },
        firstTermAmt: { type: Number, default: 0 },
        secondTermAmt: { type: Number, default: 0 },
        busFirstTermAmt: { type: Number, default: 0 },
        busSecondTermAmt: { type: Number, default: 0 },
    },

    feePaidv1: {
        type: Map,
        of: Number,
        default: {},
    },


    // === DISCOUNTS / CONCESSIONS ===
    concession: {
        isApplied: { type: Boolean, default: false },
        type: { type: String, default: null },//percentage or amount
        value: { type: Number, default: 0 },
        inAmount: { type: Number, default: 0 },
        remark: { type: String },
        proof: { type: uploadSchema, default: null }, // S3 Link
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserModel" }
    },

    dues: {
        admissionDues: { type: Number, default: null },
        firstTermDues: { type: Number, default: null },
        secondTermDues: { type: Number, default: null },
        busfirstTermDues: { type: Number, default: null },
        busSecondTermDues: { type: Number, default: null },
    },

    duesv1: {
        type: Map,
        of: Number,
        default: {},
    },

    isActive: { type: Boolean, default: true },

    isBusApplicable: { type: Boolean, default: false }, // The new field

    // === CALCULATED TOTALS ===
    // totalDue: { type: Number, default: 0 },
    isFullyPaid: { type: Boolean, default: false },

    // === OPTIONAL: BUS DETAILS FOR THIS YEAR ===
    busPoint: {
        type: String, default: null
    },

}, { timestamps: true });

// CONSTRAINT: One Record per Student per Academic Year
// StudentRecordSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });


StudentRecordSchema.index({
    schoolId: 1,
    studentId: 1,
    academicYear: 1
});

const StudentRecordModel = mongoose.model('StudentRecord', StudentRecordSchema);
export default StudentRecordModel;
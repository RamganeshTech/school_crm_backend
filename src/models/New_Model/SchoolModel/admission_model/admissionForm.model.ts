import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAdmissionForm extends Document {
    schoolId: Types.ObjectId;
    academicYear: string;
    formNumber: string; // The auto-generated ADM-2026-001 sequence
    admissionBookId: Types.ObjectId;

    studentId: Types.ObjectId;
    // Student Details
    studentName: string;
    mobileNumber: string;
    dob: Date;
    age: number;
    gender: string;
    motherTongue: string;
    religion: string;
    community: string;
    emisNumber?: string; // Optional

    // Addresses
    currentAddress: string;
    permanentAddress: string;

    // Parent Details
    fatherName: string;
    fatherEducation: string;
    fatherOccupation: string;
    motherName: string;
    motherEducation: string;
    motherOccupation: string;

    // Academic Details
    examinationPassed: string; // Previous education
    admissionSoughtFor: string; // The class/grade they want to join

    // Internal Processing
    status: 'Pending' | 'Approved' | 'Rejected';
    submittedAt: Date;
    isSubmitted: boolean;

    createdAt: Date
    updatedAt: Date
}

const AdmissionFormSchema = new Schema<IAdmissionForm>({
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    // academicYear: { type: String, required: true },
    formNumber: { type: String, required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentNewModel", default: null },
    admissionBookId: {type: mongoose.Schema.Types.ObjectId, ref: "AdmissionBookModel", default: null},
    studentName: { type: String },
    mobileNumber: { type: String },
    dob: { type: Date },
    age: { type: Number },
    gender: { type: String },
    motherTongue: { type: String },
    religion: { type: String },
    community: { type: String },
    emisNumber: { type: String, default: null },

    currentAddress: { type: String },
    permanentAddress: { type: String },

    fatherName: { type: String },
    fatherEducation: { type: String },
    fatherOccupation: { type: String },
    motherName: { type: String },
    motherEducation: { type: String },
    motherOccupation: { type: String },

    examinationPassed: { type: String },
    admissionSoughtFor: { type: String }, // e.g., "Class 1", "LKG"

    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    submittedAt: { type: Date, default: new Date() },
    isSubmitted: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure form numbers are unique per school per year
AdmissionFormSchema.index({ schoolId: 1, formNumber: 1 });

const AdmissionFormModel = mongoose.model<IAdmissionForm>('AdmissionFormModel', AdmissionFormSchema);
export default AdmissionFormModel;
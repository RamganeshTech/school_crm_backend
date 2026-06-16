import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAdmissionBook extends Document {
    schoolId: Types.ObjectId;
    academicYear: string;
    bookName: string;
    formNumber: string; // The exact number that will be used for the NEXT admission form
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const AdmissionBookSchema = new Schema<IAdmissionBook>({
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    academicYear: { type: String },
    
    // e.g., "General Admissions 2026" or "Primary Wing Forms"
    bookName: { type: String, required: true, trim: true }, 
    
    // e.g., "ADM-2026-001" or "1001"
    formNumber: { type: String, required: true, trim: true }, 
    
    isActive: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "UserModel", required: true }
}, { timestamps: true });

// Ensure only ONE active admission book exists per school per academic year
// This prevents the system from getting confused about which sequence to use
AdmissionBookSchema.index(
    { schoolId: 1 }, 
   
);

const AdmissionBookModel = mongoose.model<IAdmissionBook>('AdmissionBookModel', AdmissionBookSchema);
export default AdmissionBookModel;
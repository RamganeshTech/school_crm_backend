import mongoose, { Schema, Document, Types } from "mongoose";

export interface IBillBook extends Document {
    schoolId: Types.ObjectId;
    academicYear: string;
    bookName: string;
    billNumber: string; // The exact number that will be used for the NEXT receipt
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const BillBookSchema = new Schema<IBillBook>({
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    academicYear: { type: String, required: true },
    bookName: { type: String, required: true, trim: true }, // e.g., "Main Counter Book A"
    
    // The exact number the next receipt will use. 
    billNumber: { type: String, required: true, }, 
    
    isActive: { type: Boolean, default:false },
    createdBy: { type: Schema.Types.ObjectId, ref: "UserModel", required: true }
}, { timestamps: true });

// Ensure only ONE active bill book exists per school per academic year
// BillBookSchema.index({ schoolId: 1, academicYear: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
// Ensure book names are unique per school per year
// BillBookSchema.index({ schoolId: 1, academicYear: 1, bookName: 1 }, { unique: true });

const BillBookModel = mongoose.model<IBillBook>('BillBookModel', BillBookSchema);
export default BillBookModel;
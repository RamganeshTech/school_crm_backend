import mongoose, { Schema, Document, Types } from "mongoose";

export interface IBillRecord extends Document {
    schoolId: Types.ObjectId;
    academicYear: string | null,
    billBookId: Types.ObjectId;
    studentId: Types.ObjectId;
    feeReceiptId: Types.ObjectId; // Links to the actual payment transaction
    billNumber: string; // The exact generated string (e.g., "BMB-001")
    createdAt: Date;
    updatedAt: Date;
}

const BillRecordSchema = new Schema<IBillRecord>({
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    academicYear: { type: String, default: null },
    billBookId: { type: Schema.Types.ObjectId, ref: "BillBookModel", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "StudentNewModel", },
    feeReceiptId: { type: Schema.Types.ObjectId, ref: "FeeTransactionModel", required: true },

    // The actual finalized bill number for this transaction
    billNumber: { type: String, required: true },

}, { timestamps: true });

// Index for fast querying by school (for dashboard ledgers)
BillRecordSchema.index({ schoolId: 1 });

const BillBookRecordModel = (mongoose.models.BillBookRecordModel as mongoose.Model<IBillRecord>) || mongoose.model<IBillRecord>('BillBookRecordModel', BillRecordSchema);
export default BillBookRecordModel;
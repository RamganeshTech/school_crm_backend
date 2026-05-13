
import mongoose, { Schema, Document, Types } from "mongoose";

// 1. Sub-interface for the fee components
export interface IFeeHead {
    admissionFee: number;
    firstTermAmt: number;
    secondTermAmt: number;
    busFirstTermAmt: number;
    busSecondTermAmt: number;
}

// 2. Main Fee Structure Interface
export interface IFeeStructure extends Document {
    schoolId: Types.ObjectId;
    classId: Types.ObjectId;
    type?: string | null;
    feeHead: IFeeHead;
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
}

const FeeStructureSchema = new mongoose.Schema<IFeeStructure>({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolModel", },

  // The Standard: Fees are defined per Class, per Year
  // academicYear: { type: String, required: true }, // e.g., "2025-2026"
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassModel", },

  type: { type: String, default: null },
  // The Fixed Amounts (The Limits)
  feeHead: {
    admissionFee: { type: Number, default: 0 },
    firstTermAmt: { type: Number, default: 0 },
    secondTermAmt: { type: Number, default: 0 },
    // annualFee: { type: Number, default: 0 },
    busFirstTermAmt: { type: Number, default: 0 },
    busSecondTermAmt: { type: Number, default: 0 },
  },

  totalAmount: { type: Number, default: 0 } // Auto-calculated sum

}, { timestamps: true });

// CONSTRAINT: One Fee Structure per Class per Year
// ClassFeeMasterSchema.index({ schoolId: 1, classId: 1, academicYear: 1 }, { unique: true });


FeeStructureSchema.index({ schoolId: 1, classId: 1 });

const FeeStructureModel = mongoose.model('FeeStructureModel', FeeStructureSchema);

export default FeeStructureModel;
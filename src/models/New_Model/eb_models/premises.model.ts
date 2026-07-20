import { Schema, model, Document, Types } from "mongoose";

export interface IPremises extends Document {
  schoolId: Types.ObjectId;
  premisesName: string;
  premisesAddress?: string;
  meterLocation?: string;
  consumerNumber?: string;
  tariffId?: Types.ObjectId;
  sanctionedLoad?: number;
  billingCycleStartDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PremisesSchema = new Schema<IPremises>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "SchoolModel",
      required: true,
    },
    premisesName: {
      type: String,
      required: true,
      trim: true,
    },
    premisesAddress: { type: String, trim: true, },
    meterLocation: { type: String, trim: true, },
    consumerNumber: { type: String, trim: true, },
    tariffId: { type: Schema.Types.ObjectId, ref: "TariffModel", },
    sanctionedLoad: { type: Number, },
    billingCycleStartDate: { type: Date, },
    isActive: { type: Boolean, default: true, },
  },
  { timestamps: true }
);

// prevent duplicate premises names within the same school
PremisesSchema.index({ schoolId: 1, name: 1 });

export const PremisesModel = model<IPremises>("PremisesModel", PremisesSchema);
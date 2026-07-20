import { Schema, model, Document, Types } from "mongoose";

export interface ITariffSlab {
    upto: number | null; // null = unbounded (last slab)
    ratePerUnit: number;
}

export interface ITariff extends Document {
    schoolId: Types.ObjectId;
    tariffName: string; // e.g. "Commercial", "Industrial", "Educational"
    fixedChargePerKw: number; // ₹ per kW per billing cycle
    slabs: ITariffSlab[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const TariffSlabSchema = new Schema<ITariffSlab>(
    {
        upto: { type: Number, default: null },
        ratePerUnit: { type: Number, required: true },
    },
    { _id: true }
);

const TariffSchema = new Schema<ITariff>(
    {
        schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
        tariffName: { type: String, required: true, trim: true },
        fixedChargePerKw: { type: Number, required: true },
        slabs: { type: [TariffSlabSchema], default: [] },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

TariffSchema.index({ schoolId: 1 });

export const TariffModel = model<ITariff>("TariffModel", TariffSchema);
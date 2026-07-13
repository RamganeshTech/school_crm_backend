import { Schema, model, Types, Document } from "mongoose";

// ---------- Types ----------

export interface IFuelLog extends Document {
  schoolId: Types.ObjectId; // tenant scoping
  busId: Types.ObjectId; // ref Bus

  date: Date;

  litres: number | null;
  amount: number | null;
  ratePerLitre: number | null; // auto-calculated: amount / litres

  odometerAtFill: number | null;
  billReference: string | null;

  enteredBy: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// ---------- Schema ----------

const FuelLogSchema = new Schema<IFuelLog>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true,  },
    busId: { type: Schema.Types.ObjectId, ref: "BusModel", required: true },

    date: { type: Date, required:true },

    litres: { type: Number, default: null },
    amount: { type: Number, default: null },
    ratePerLitre: { type: Number, default: null },

    odometerAtFill: { type: Number, default: null },
    billReference: { type: String, default: null },

    enteredBy: { type: String, default: null },
  },
  { timestamps: true }
);

FuelLogSchema.index({ schoolId: 1, busId: 1 });

// auto-calc rate per litre whenever both amount and litres are present
FuelLogSchema.pre("save", function (next) {
  if (this.amount !== null && this.litres !== null && this.litres !== 0) {
    this.ratePerLitre = Math.round((this.amount / this.litres) * 100) / 100;
  } else {
    this.ratePerLitre = null;
  }
  next();
});

export const FuelLogModel = model<IFuelLog>("FuelLogModel", FuelLogSchema);
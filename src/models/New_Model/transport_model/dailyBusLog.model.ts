import { Schema, model, Types, Document } from "mongoose";

// ---------- Types ----------

export interface IDailyLog extends Document {
  schoolId: Types.ObjectId; // tenant scoping
  busId: Types.ObjectId; // ref Bus

  date: Date;

  openingOdometer: number | null;
  closingOdometer: number | null;
  kmRun: number | null; // auto-calculated: closingOdometer - openingOdometer

  enteredBy: string | null; // e.g. "Admin office", driver name, etc.
  note: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// ---------- Schema ----------

const DailyLogSchema = new Schema<IDailyLog>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    busId: { type: Schema.Types.ObjectId, ref: "BusModel", required: true },

    date: { type: Date, required: true },

    openingOdometer: { type: Number, default: null },
    closingOdometer: { type: Number, default: null },
    kmRun: { type: Number, default: null },

    enteredBy: { type: String, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

// one entry per bus per day
DailyLogSchema.index({ schoolId: 1, busId: 1, });

// auto-calc kmRun whenever both readings are present
DailyLogSchema.pre("save", function (next) {
  if (this.openingOdometer !== null && this.closingOdometer !== null) {
    this.kmRun = this.closingOdometer - this.openingOdometer;
  } else {
    this.kmRun = null;
  }
  next();
});

export const DailyLogModel = model<IDailyLog>("DailyBusLogModel", DailyLogSchema);
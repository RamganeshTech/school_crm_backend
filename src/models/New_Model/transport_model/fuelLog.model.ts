import { Schema, model, Document, Types } from "mongoose";

export interface IFuelLog extends Document {
  schoolId: Types.ObjectId;
  busId: Types.ObjectId;
  fuelLogNo: string | null;
  date: Date | null;
  enteredBy: Types.ObjectId | null;
  odometerReading: number | null;
  fuelQuantity: number | null;
  pricePerLiter: number | null;
  totalAmount: number | null;
  fuelStation: string | null;
  paymentMode: string | null;
  fuelBillNo: string | null;
  academicYear: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const fuelLogSchema = new Schema<IFuelLog>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "SchoolModel",
      required: true,
    },
    busId: {
      type: Schema.Types.ObjectId,
      ref: "BusModel",
      required: true,
    },
    fuelLogNo: { type: String, default: null },
    date: {
      type: Date,
      default: null,
    },
    enteredBy: {
      type: Schema.Types.ObjectId,
      ref: "UserModel",
      default: null,
    },
    odometerReading: { type: Number, default: null }, //before filling
    fuelQuantity: { type: Number, default: null },
    pricePerLiter: { type: Number, default: null },
    totalAmount: { type: Number, default: null },
    fuelStation: { type: String, default: null },
    paymentMode: { type: String, default: null },
    fuelBillNo: { type: String, default: null },
    academicYear: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

// Generate fuelLogNo only on creation, scoped per school per year
fuelLogSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {
    const currentYear = new Date().getFullYear();
    const Model = this.constructor as typeof FuelLogModel;

    const lastLog = await Model.findOne({
      schoolId: this.schoolId,
      fuelLogNo: { $regex: `^FL-${currentYear}-` },
    })
      .sort({ createdAt: -1 })
      .lean();

    let nextSeq = 1;
    if (lastLog?.fuelLogNo) {
      const lastSeq = parseInt((lastLog.fuelLogNo as any).split("-")[2], 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    const paddedSeq =
      nextSeq < 10000 ? String(nextSeq).padStart(4, "0") : String(nextSeq);

    this.fuelLogNo = `FL-${currentYear}-${paddedSeq}`;
    next();
  } catch (err) {
    next(err as Error);
  }
});


// Prevent duplicate log entry for same bus, same date, same school
fuelLogSchema.index(
  { schoolId: 1, busId: 1 },
);

export const FuelLogModel = model<IFuelLog>("FuelLogModel", fuelLogSchema);
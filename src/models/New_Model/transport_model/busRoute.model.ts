import { Schema, model, Document, Types } from "mongoose";

// ---------- Types ----------

interface IStop {
    // stopId: string;       // short unique id within route (e.g. nanoid or ObjectId string)
    _id: Types.ObjectId
    stopName: string;
    landmark?: string;
    order: number;
    latitude: number;
    longitude: number;
    googlePlaceId: string;
}

interface IStopTiming {
    stopId: Types.ObjectId;
    stopName: string;
    time: string;          // "07:45 AM" style, keep as string not Date
}

interface IAssignment {
    busId: Types.ObjectId;
    driverId: Types.ObjectId;
    shift: "pickup" | "drop";
    stopTimings: IStopTiming[];
    isActive: boolean;
}

export interface IBusRoute extends Document {
    schoolId: Types.ObjectId;
    routeNo: string;               // auto-generated: RU-2026-999
    routeName: string;
    stops: IStop[];
    assignments: IAssignment[];
    feeAmount: number;
    feeFrequency: "term" | "monthly" | "annual";
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// ---------- Schema ----------

const stopSchema = new Schema<IStop>(
    {
        // stopId: { type: String, },
        stopName: { type: String, },
        landmark: { type: String },
        order: { type: Number },
        latitude: { type: Number },
        longitude: { type: Number },
        googlePlaceId: { type: String },
    },
    { _id: true }
);

const stopTimingSchema = new Schema<IStopTiming>(
    {
        stopId: { type: Schema.Types.ObjectId, },
        stopName: {type:String},
        time: { type: String, },
    },
    { _id: true }
);

const assignmentSchema = new Schema<IAssignment>(
    {
        busId: { type: Schema.Types.ObjectId, ref: "BusModel", },
        driverId: { type: Schema.Types.ObjectId, ref: "DriverModel", },
        shift: { type: String, enum: ["pickup", "drop"], },
        stopTimings: { type: [stopTimingSchema], default: [] },
        isActive: { type: Boolean, default: true },
    },
    { _id: true }
);

const busRouteSchema = new Schema<IBusRoute>(
    {
        schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
        routeNo: { type: String, },
        routeName: { type: String, required: true },
        stops: { type: [stopSchema], default: [] },
        assignments: { type: [assignmentSchema], default: [] },
        feeAmount: { type: Number, default: null },
        feeFrequency: {
            type: String,
            enum: ["term", "monthly", "annual"],
            default: "term",
        },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// ---------- Pre-save hook: routeNo generation ----------
busRouteSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  const currentYear = new Date().getFullYear();
  const prefix = `RU-${currentYear}-`;

  const lastRoute = await (this.constructor as any)
    .find({
      schoolId: this.schoolId,
      routeNo: { $regex: `^${prefix}` },
    })
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();

  let nextNumber = 0;

  if (lastRoute.length > 0) {
    const lastNumberStr = lastRoute[0].routeNo.split("-").pop();
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  this.routeNo = `${prefix}${String(nextNumber).padStart(3, "0")}`;
  next();
});

const BusRouteModel = model<IBusRoute>("BusRouteModel", busRouteSchema);
export default BusRouteModel;
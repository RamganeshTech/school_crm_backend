import { Schema, model, Document, Types } from "mongoose";

export interface IDailyTripLog extends Document {
    schoolId: Types.ObjectId;
    busId: Types.ObjectId;
    date: Date;
    dailyLogNo: string
    enteredBy: Types.ObjectId;
    openingOdometer: number;
    closingOdometer: number;
    kmRun: number;
    academicYear: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const dailyTripLogSchema = new Schema<IDailyTripLog>(
    {
        schoolId: {
            type: Schema.Types.ObjectId,
            ref: "SchoolModel",
            required: true,
        },
        academicYear: { type: String, default: null, },

        busId: {
            type: Schema.Types.ObjectId,
            ref: "BusModel",
            required: true,
        },
        dailyLogNo: { type: String, default: null },
        date: {
            type: Date,
            default: null,
        },
        enteredBy: { type: Schema.Types.ObjectId, ref: "UserModel", default: null, },
        openingOdometer: { type: Number, default: null, },
        closingOdometer: { type: Number, default: null, },
        kmRun: { type: Number, default: null, },
        notes: { type: String, default: null, },
    },
    { timestamps: true }
);


// Generate dailyLogNo only on creation, scoped per school per year
dailyTripLogSchema.pre("save", async function (next) {
    if (!this.isNew) return next();

    try {
        const currentYear = new Date().getFullYear();
        const Model = this.constructor as typeof DailyTripLogModel;

        const lastLog = await Model.findOne({
            schoolId: this.schoolId,
            // dailyLogNo: { $regex: `^DL-${currentYear}-` },
        })
            .sort({ createdAt: -1 })
            .lean();

        let nextSeq = 1;
        if (lastLog?.dailyLogNo) {
            const lastSeq = parseInt((lastLog.dailyLogNo as any).split("-")[2], 10);
            if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
        }

        const paddedSeq =
            nextSeq < 10000 ? String(nextSeq).padStart(4, "0") : String(nextSeq);

        this.dailyLogNo = `DL-${currentYear}-${paddedSeq}`;
        next();
    } catch (err) {
        next(err as Error);
    }
});


// Prevent duplicate log entry for same bus, same date, same school
dailyTripLogSchema.index(
    { schoolId: 1, busId: 1 },
);


export const DailyTripLogModel = model<IDailyTripLog>(
    "DailyTripLogModel",
    dailyTripLogSchema
);
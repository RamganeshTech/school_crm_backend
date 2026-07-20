import { Schema, model, Document, Types } from "mongoose";

export interface IEBLog extends Document {
    schoolId: Types.ObjectId;
    premisesId: Types.ObjectId;
    ebLogNo: string;

    date: Date;
    time: string;
    meterReading: number;
    note?: string;
    createdAt: Date;
    kwUsed: number | null;
    updatedAt: Date;
}

const EBLogSchema = new Schema<IEBLog>(
    {
        schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
        premisesId: { type: Schema.Types.ObjectId, ref: "PremisesModel", required: true, },
        ebLogNo: { type: String, default: null },
        date: { type: Date, },
        time: { type: String, },
        meterReading: { type: Number, },
        kwUsed: { type: Number, default: null }, // consumption since the previous log for this premises

        note: { type: String, trim: true, },
    },
    { timestamps: true }
);


// Generate ebLogNo only on creation, scoped per school per year
EBLogSchema.pre("save", async function (next) {
    if (!this.isNew) return next();

    try {
        const currentYear = new Date().getFullYear();
        const Model = this.constructor as typeof EBLogModel;

        const lastLog = await Model.findOne({
            schoolId: this.schoolId,
            ebLogNo: { $regex: `^EB-${currentYear}-` },
        })
            .sort({ createdAt: -1 })
            .lean();

        let nextSeq = 0; // start from 000
        if (lastLog?.ebLogNo) {
            const lastSeq = parseInt((lastLog.ebLogNo as any).split("-")[2], 10);
            if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
        }

        const paddedSeq =
            nextSeq < 1000 ? String(nextSeq).padStart(3, "0") : String(nextSeq);

        this.ebLogNo = `EB-${currentYear}-${paddedSeq}`;
        next();
    } catch (err) {
        next(err as Error);
    }
});

EBLogSchema.index({ schoolId: 1, ebLogNo: 1 });

const EBLogModel = model<IEBLog>("EBLogModel", EBLogSchema);

export default EBLogModel;
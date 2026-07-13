import { Schema, model, Types, Document } from "mongoose";
import type { IUpload } from "../announcement_model/announcement.model.js";

// ---------- Sub-schemas ----------

export type StatutoryDocStatus = "valid" | "expiring_soon" | "expired";

export interface IStatutoryDocument {
    _id: Types.ObjectId;
    documentName: string | null; // e.g. "RC", "Insurance", "Fitness Certificate", "Permit", "PUC", "Road Tax"
    expiry: Date | null;
    lastCost?: number;
    status: StatutoryDocStatus; // recomputed on save / by cron, not just set manually
    files: IUpload[];
}


const uploadSchema = new Schema<IUpload>({
    type: { type: String, enum: ["image", "pdf", "video"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, { _id: true });


const StatutoryDocumentSchema = new Schema<IStatutoryDocument>(
    {
        documentName: { type: String, default: null },
        expiry: { type: Date, default: null },
        lastCost: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ["valid", "expiring_soon", "expired"],
            default: "valid",
        },
        files: { type: [uploadSchema], default: [] },
    },
    { _id: true } // keep _id so a single doc row (e.g. "Insurance") can be targeted for file upload/replace
);

// ---------- Main Bus schema ----------

export type BusOperationalStatus =
    | "active"
    | "in_service" // under maintenance / workshop
    | "on_trip" // currently assigned to a school tour/trip
    | "inactive";

export type FuelType = "diesel" | "petrol" | "cng" | "electric";

export interface IBus extends Document {
    schoolId: Types.ObjectId; // tenant scoping, same pattern as rest of EduNest

    busNumber: string; // internal fleet code, e.g. "BUS-04"
    registrationNo: string; // license plate, unique per school

    makeModel: string; // "Make & model"
    year: number;
    seatingCapacity: number;
    fuelType: FuelType;
    chassisNo: string;
    engineNo: string;
    purchaseDate: Date;
    rcOwner: string;

    statutoryDocuments: IStatutoryDocument[];

    nextServiceDate?: Date;
    lastServiceDate?: Date;

    assignedDriverId?: Types.ObjectId; // ref Driver

    operationalStatus: BusOperationalStatus;



    createdAt: Date;
    updatedAt: Date;
}

const BusSchema = new Schema<IBus>(
    {
        schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true, },

        busNumber: { type: String, default: null, trim: true },
        registrationNo: { type: String, default: null, trim: true, },

        makeModel: { type: String, default: null },
        year: { type: Number, default: null },
        seatingCapacity: { type: Number, default: null },
        fuelType: {
            type: String,
            //   enum: ["diesel", "petrol", "cng", "electric"],
            //   required: true,
        },
        chassisNo: { type: String, default: null },
        engineNo: { type: String, default: null },
        purchaseDate: { type: Date, default: null },
        rcOwner: { type: String, default: null },

        statutoryDocuments: { type: [StatutoryDocumentSchema], default: [] },

        nextServiceDate: { type: Date },
        lastServiceDate: { type: Date },

        assignedDriverId: { type: Schema.Types.ObjectId, ref: "DriverModel" },

        operationalStatus: {
            type: String,
            enum: ["active", "in_service", "on_trip", "inactive"],
            default: "active",
        },
    },
    { timestamps: true }
);

// one registration number per school, not globally (in case of multi-branch groups reusing formats)
BusSchema.index({ schoolId: 1, });

export const BusModel = model<IBus>("BusModel", BusSchema);
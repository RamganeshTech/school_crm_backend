import { Schema, model, Types, Document } from "mongoose";
import type { IUpload } from "../announcement_model/announcement.model.js";



export type DriverDocStatus = "valid" | "expiring_soon" | "expired";


export const DRIVER_DOCUMENT_NAMES = [
  "Driving License",
  "Badge",
  "Police Verification",
  "Medical Certificate",
  "Aadhar Card",
  "Other",
] as const;
 
export type DriverDocumentName = (typeof DRIVER_DOCUMENT_NAMES)[number];
 
 
export interface IDriverDocument {
    _id: Types.ObjectId
    documentName: string; // e.g. "Driving License", "Badge", "Police Verification", "Medical Certificate"
    // documentType: "driving_license"| "badge"| "police_verification"| "medical_certificate"| "aadhar_card"| "other"
    detail?: string; // e.g. license number / issuing authority
    expiryDate?: Date; // some docs (e.g. police verification) may not expire
    status: DriverDocStatus;
    files: IUpload[];
}

// ---------- Sub-schemas ----------

const uploadSchema = new Schema<IUpload>({
    type: { type: String, enum: ["image", "pdf", "video"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, { _id: true });

const DriverDocumentSchema = new Schema<IDriverDocument>(
    {
        documentName: { type: String, default: null },
        // documentType: {
        //     type: String,
        //     enum: ["driving_license", "badge", "police_verification", "medical_certificate", "aadhar_card", "other"],
        //     default: null,
        // },
        detail: { type: String, default: null },
        expiryDate: { type: Date, default: null },
        status: {
            type: String,
            enum: ["valid", "expiring_soon", "expired", null],
            default: "valid",
        },
        files: { type: [uploadSchema], default: [] },
    },
    { _id: true }
);

// ---------- Main Driver schema ----------

export type DriverStatus = "active" | "inactive" | "on_leave";

export interface IDriver extends Document {
    schoolId: Types.ObjectId; // tenant scoping

    name: string;
    phone: string;
    assignedBusId: Types.ObjectId; // ref Bus

    dateOfBirth: Date;
    joinedDate: Date;
    emergencyContact: string;
    address: string;
    photo: IUpload; // file url

    documents: IDriverDocument[];

    status: DriverStatus;

    createdAt: Date;
    updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
    {
        schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },

        name: { type: String, default: null, trim: true },
        phone: { type: String, default: null, trim: true },
        assignedBusId: { type: Schema.Types.ObjectId, ref: "BusModel", default: null },

        dateOfBirth: { type: Date, default: null },
        joinedDate: { type: Date, default: null },
        emergencyContact: { type: String, default: null },
        address: { type: String, default: null },
        photo: { type: uploadSchema, default: null },

        documents: { type: [DriverDocumentSchema], default: [] },

        status: {
            type: String,
            enum: ["active", "inactive", "on_leave"],
            default: "active",
        },
    },
    { timestamps: true }
);

DriverSchema.index({ schoolId: 1 });

export const DriverModel = model<IDriver>("DriverModel", DriverSchema);
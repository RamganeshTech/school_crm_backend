import mongoose, { Schema, Document, Types } from "mongoose";


export interface IUpload {
    type: "image" | "pdf";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

export interface IEmployeeProfile extends Document {
    userId: Types.ObjectId;      // Links to the main UserModel
    schoolId: Types.ObjectId;    // Links to the SchoolModel

    // Core Employment Details
    employeeNo: string;          // e.g., "EMP-2026-001"
    designation: string;         // e.g., "Senior Science Teacher", "Accountant"
    department: string;          // e.g., "Science", "Administration", "Transport"
    dateOfJoining: Date;
    employmentType: "full_time" | "part_time" | "contract" | "temporary";

    currentAddress: string
    permanentAddress: string 

    // Sensitive HR Details
    nationalId: string;          // Government ID (e.g., [Aadhaar Redacted] / PAN)
    pfNumber?: string;           // Provident Fund number

    // Qualifications & Experience
    qualifications: string[];    // e.g., ["B.Ed", "M.Sc Physics"]
    yearsOfExperience: number;
    previousWorkplace?: string;

    // Payroll / Bank Details (Optional but standard for staff)
    bankDetails?: {
        accountName: string;
        accountNumber: string;
        bankName: string;
        ifscCode: string;
    };

    // Emergency Contact
    emergencyContact: {
        name: string;
        relation: string;
        phone: string;
    };

    educationDetails: {
        degree?: string | null;
        institution?: string | null;
        yearOfPassing?: string | null;
        grade?: string | null
    }[]

    isActive: boolean;           // To handle resignations/terminations without deleting records
    documents: IUpload
    createdAt: Date;
    updatedAt: Date;
}



const uploadSchema = new Schema<IUpload>({
    type: { type: String, enum: ["image", "pdf"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, { _id: true });


const EducationSchema = new Schema({
    degree: { type: String, default: null },       // e.g., "B.Tech Computer Science"
    institution: { type: String, default: null },  // e.g., "Anna University"
    yearOfPassing: { type: String, default: null },// e.g., "2024"
    grade: { type: String, default: null }          // e.g., "8.5 CGPA" or "85%"
}, { _id: true });


const EmployeeProfileSchema = new Schema<IEmployeeProfile>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "UserModel",
            required: true,
            unique: true // Ensures 1-to-1 mapping. A user can only have ONE employee profile.
        },
        schoolId: {
            type: Schema.Types.ObjectId,
            ref: "SchoolModel",
            required: true
        },

        currentAddress: { type: String, default: null },
        permanentAddress: { type: String, default: null },

        employeeNo: { type: String, trim: true },
        designation: { type: String, default: null },
        department: { type: String, default: null },
        dateOfJoining: { type: Date, default: null },
        employmentType: {
            type: String,
            enum: ["full_time", "part_time", "contract", "temporary", ""],
            default: "full_time"
        },

        educationDetails: { type: [EducationSchema], default: [] },

        nationalId: { type: String, default: null }, // Store Government ID securely here
        pfNumber: { type: String, default: null },

        // qualifications: { type: [String], default: [] },
        yearsOfExperience: { type: Number, default: null },
        previousWorkplace: { type: String, default: null },

        bankDetails: {
            accountName: { type: String, default: null },
            accountNumber: { type: String, default: null },
            bankName: { type: String, default: null },
            ifscCode: { type: String, default: null },
        },

        emergencyContact: {
            name: { type: String, default: null },
            relation: { type: String, default: null },
            phone: { type: String, default: null },
        },

        isActive: { type: Boolean, default: true },

        documents: { type: [uploadSchema], default: [] }
    },
    { timestamps: true }
);

// Indexes for fast lookups
EmployeeProfileSchema.index({ userId: 1 });
EmployeeProfileSchema.index({ schoolId: 1, employeeNo: 1 }, { unique: true }); // Employee IDs must be unique within a specific school

const EmployeeProfileModel = mongoose.models.EmployeeProfileModel as mongoose.Model<IEmployeeProfile> || mongoose.model<IEmployeeProfile>("EmployeeProfileModel", EmployeeProfileSchema);

export default EmployeeProfileModel;
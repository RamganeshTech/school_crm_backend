import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDeletedArchive extends Document {
    schoolId: Types.ObjectId;
    category: string; // e.g., "Expense", "Student"
    originalId: Types.ObjectId;
    deletedData: any; // Using any because it holds a full JSON dump of various models
    deletedBy?: Types.ObjectId;
    reason?: string | null;
    deletedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const deletedArchiveSchema = new mongoose.Schema<IDeletedArchive>(
    {
        // --- TENANCY & IDENTIFICATION ---
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SchoolModel",
            required: true,
        },

        // What kind of data is this? (e.g., "Expense", "Student", "Staff", "Income")
        category: {
            type: String,
            required: true,
            //   index: true // Indexed for faster filtering
        },

        // The ID of the document BEFORE it was deleted (Reference purpose)
        originalId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        // --- THE DATA DUMP ---
        // "Mixed" type allows storing any JSON structure/Object here
        // This will hold the entire deleted document exactly as it was
        deletedData: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },

        // --- AUDIT TRAIL ---
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel", // The user/staff/correspondent who performed the delete
            //   required: true
        },

        // deletedByRole: {
        //     type: String, // Useful to know if "admin" or "correspondent" deleted it
        // },

        reason: {
            type: String,
            default: null,
        },

        deletedAt: {
            type: Date,
            default: new Date(),
        },

    },
    {
        timestamps: true // Adds createdAt (same as deletedAt) and updatedAt
    }
);

// --- INDEXES ---
// 1. To quickly find all deleted items for a school
// deletedArchiveSchema.index({ schoolId: 1, category: 1 });
// // 2. To sort by deletion date
// deletedArchiveSchema.index({ deletedAt: -1 });
deletedArchiveSchema.index({schoolId:1});

export const DeletedArchiveModel = mongoose.model("DeletedArchiveModel", deletedArchiveSchema);
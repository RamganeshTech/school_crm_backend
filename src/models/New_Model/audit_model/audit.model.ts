

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
    schoolId: Types.ObjectId;
    userId?: Types.ObjectId;
    userName?: string | null;
    role?: string | null;
    action: string; // e.g., "CREATE", "DELETE"
    module: string; // e.g., "Expense", "Student"
    targetId?: Types.ObjectId;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    status: string; // "success" or "failure"
    createdAt: Date;
    updatedAt: Date;
}


const auditLogSchema = new mongoose.Schema<IAuditLog>(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SchoolModel",
            required: true,
        },

        // --- WHO ---
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel", // Links to Accountant, Principal, etc.
            // required: true
        },
        userName: { type: String, default: null }, // Snapshot of name in case user is deleted
        role: { type: String, default: null },

        // --- WHAT ---
        action: {
            type: String,
            // enum: ["create", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT"],
            // required: true
        },
        module: {
            type: String,
            // required: true // e.g., "Expense", "Announcement", "Student"
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId, // The ID of the item created/deleted
        },
        description: { type: String }, // e.g., "Deleted Expense EXP-001"

        // --- TECHNICAL DETAILS ---
        ipAddress: { type: String },
        userAgent: { type: String }, // Browser/Device info
        status: { type: String,
            //  enum: ["SUCCESS", "FAILURE"],
              default: "success" },

    },
    { timestamps: true }
);

// Auto-expire logs after 1 year (Optional - saves DB space)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
auditLogSchema.index({schoolId:1});

export const AuditLogModel = mongoose.model("AuditLogModel", auditLogSchema);
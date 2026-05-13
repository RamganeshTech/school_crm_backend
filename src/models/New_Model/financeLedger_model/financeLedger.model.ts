import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFinanceLedger extends Document {
    schoolId: Types.ObjectId;
    academicYear: string | null;
    
    // Double-Entry Logic
    transactionType: "CREDIT" | "DEBIT"; // CREDIT (+) In, DEBIT (-) Out
    amount: number;
    date: Date;

    // Polymorphic Link
    referenceModel: "ExpenseModel" | "FeeTransactionModel" | "IncomeModel";
    referenceId: Types.ObjectId;

    // Contextual Data
    studentRecordId?: Types.ObjectId | null;
    feeReceiptId?: Types.ObjectId | null;
    category: string;
    section?: string;
    paymentMode: string;
    description?: string;

    // Status & Immutability
    status: "active" | "cancelled" | "bounced";
    penaltyAmount?: number;
    cancellationReason?: string | null;

    // Audit Trail
    createdBy: Types.ObjectId | null;
    cancelledBy?: Types.ObjectId | null;
    
    createdAt: Date;
    updatedAt: Date;
}

const financeLedgerSchema = new mongoose.Schema<IFinanceLedger>(
    {
        // --- 1. TENANCY ---
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SchoolModel",
            required: true,
            //   index: true, // Crucial for filtering by school
        },

        academicYear: { type: String, default: null },

        // --- 2. DOUBLE-ENTRY CORE LOGIC ---
        // CREDIT (+) = Money Coming IN (Fees, Income)
        // DEBIT  (-) = Money Going OUT (Expenses, Salary)
        transactionType: {
            type: String,
            //   enum: ["CREDIT", "DEBIT"],
            //   required: true,
            //   index: true,
        },

        amount: {
            type: Number,
            required: true,
            //   min: 0,
        },

        date: {
            type: Date,
            default: new Date(),
            //   index: true, // Crucial for Date Range Reports
        },

        // --- 3. POLYMORPHIC REFERENCE (The Link) ---
        // This links this financial entry back to the original form (Expense or Student Fee)
        referenceModel: {
            type: String,
            //   required: true,
            //   enum: ["ExpenseModel", "StudentFeeModel", "IncomeModel"], // Add your Fee model name here
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            //   required: true,
            refPath: "referenceModel", // Dynamic linking
        },

        // --- 4. CONTEXTUAL DATA ---
        // If it's a fee, we link the student. If expense, this is null.
        studentRecordId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "StudentRecord",
            default: null,
        },


        feeReceiptId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FeeTransactionModel",
            default: null,
        },

        // e.g., "Term 1 Fee", "Generator Fuel", "Staff Salary"
        category: {
            type: String,
            //   required: true,
        },


        section: {
            type: String
        },

        // e.g., "Cash", "UPI", "Cheque" - copied from source for easier filtering
        paymentMode: {
            type: String,
            //   required: true
        },

        description: {
            type: String,
        },

        // --- 5. IMMUTABILITY & CANCELLATION (Req 2.2) ---
        // We NEVER delete from this table. We only mark as CANCELLED.
        status: {
            type: String,
            //   enum: ["active", "cancelled", "bounced"],
            default: "active",
        },

        penaltyAmount: { type: Number, },


        // If cancelled, why?
        cancellationReason: {
            type: String,
            default: null
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel",
            default: null
        },

        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel",
            default: null
        }
    },
    { timestamps: true }
);

// --- INDEXES FOR REPORTING ---
// 1. Get Balance Sheet (Income vs Expense)
// financeLedgerSchema.index({ schoolId: 1, transactionType: 1, status: 1 });

// // 2. Get Day Book (What happened on Date X?)
// financeLedgerSchema.index({ schoolId: 1, date: 1 });

// // 3. Get Student Ledger (History of one student)
// financeLedgerSchema.index({ schoolId: 1, studentId: 1 });


financeLedgerSchema.index({
    schoolId: 1,
    academicYear: 1,

});

export const FinanceLedgerModel = mongoose.model("FinanceLedgerModel", financeLedgerSchema);
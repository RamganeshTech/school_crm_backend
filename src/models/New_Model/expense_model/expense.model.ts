
import mongoose, { Schema, Document, Types } from "mongoose";

// 1. Interface for file uploads (Bills/Photos)
export interface IExpenseUpload {
    _id?: Types.ObjectId;
    type: "image" | "pdf";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

// 2. Interface for the Main Expense Document
export interface IExpense extends Document {
    expenseNo: string;
    schoolId: Types.ObjectId;
    academicYear: string | null;
    amount: number;
    category: string;
    remarks?: string;
    date: Date;
    paymentMode: string;
    chequeDetails?: {
        chequeNumber?: string;
        bankName?: string;
    };
    bill: IExpenseUpload[];
    workPhoto: IExpenseUpload[];
    verificationStatus: "pending" | "verified";
    recordedBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const uploadSchema = new Schema<IExpenseUpload>({
    type: { type: String, enum: ["image", "pdf"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, {_id:true});


const expenseSchema = new mongoose.Schema<IExpense>(
    {
        expenseNo:{type:String},
        schoolId: {
            type: mongoose.Schema.Types.ObjectId, // If you have multiple schools
            ref: "SchoolModel",
        },
        academicYear:{type:String, default:null},
        // --- BASIC DETAILS ---
        amount: { type: Number },
        category: { type: String },
        remarks: { type: String, },// Optional note about the expens
        date: { type: Date, default: new Date(), },

        // --- PAYMENT DETAILS ---
        paymentMode: { type: String, },//   enum: ["Cash", "UPI", "Cheque", "School Account Transfer"],

        // Conditional Fields (Only used if paymentMode === 'Cheque')
        chequeDetails: { chequeNumber: { type: String }, bankName: { type: String } },

        // --- EVIDENCE (FILES) ---
        // Mandatory Bill/Invoice
        bill: { type: [uploadSchema], default: null },
        workPhoto: { type: [uploadSchema], default: null},
        // Optional Work Photo

        // --- STATUS & FLAGS ---
        verificationStatus: {
            type: String,
            enum: ["pending", "verified"],
            default: "pending",
        },

        // --- METADATA ---
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel", // or "User", whoever is the accountant
        },

    },
    { timestamps: true }
);
// ---------------------------------------------------------
// PRE-HOOK: GENERATE SEQUENTIAL EXPENSE NO (EXP-001)
// ---------------------------------------------------------
expenseSchema.pre("save", async function (next) {
    // 1. Only run this if we are creating a NEW expense
    if (!this.isNew) {
        return next();
    }

    try {
        // 2. Find the last created expense GLOBALLY (across all schools)
        // using 'this.constructor' allows us to query the model without importing it
        const lastExpense = await mongoose.model("ExpenseModel").findOne(
            {}, // Empty filter = search whole collection
            { expenseNo: 1 }, // Only select the expenseNo field
            { sort: { createdAt: -1 } } // Get the absolute latest one
        );

        let nextSequence = 1;

        if (lastExpense && lastExpense.expenseNo) {
            // Format is EXP-001 or EXP-1000
            const parts = lastExpense.expenseNo.split("-"); // ["EXP", "001"]
            if (parts.length === 2) {
                const lastNum = parseInt(parts[1], 10);
                if (!isNaN(lastNum)) {
                    nextSequence = lastNum + 1;
                }
            }
        }

        // 3. Format the Sequence (Pad with 0s if less than 1000)
        // 1 -> "001", 99 -> "099", 100 -> "100", 1000 -> "1000"
        const sequenceString = nextSequence < 1000
            ? String(nextSequence).padStart(3, "0")
            : String(nextSequence);

        this.expenseNo = `EXP-${sequenceString}`;

        next();
    } catch (error:any) {
        next(error);
    }
});

expenseSchema.index({ schoolId: 1, academicYear: 1 });

export const ExpenseModel = mongoose.model("ExpenseModel", expenseSchema);
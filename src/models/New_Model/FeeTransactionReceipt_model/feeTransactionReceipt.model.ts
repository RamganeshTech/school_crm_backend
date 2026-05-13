
import mongoose, { Schema, Document, Types } from "mongoose";

// 1. Cash Denomination Interface
export interface IDenomination {
    label: string;
    count: number;
}

// 2. Fee Head Allocation Interface
export interface IFeeHeadAllocation {
    _id?: Types.ObjectId;
    feeHead: string | null;
    amount: number;
}

// 3. Upload Interface (Reusable)
export interface ITransactionUpload {
    _id?: Types.ObjectId;
    type: "image" | "pdf" | "video";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

// 4. Main Fee Transaction Interface
export interface IFeeTransaction extends Document {
    schoolId: Types.ObjectId;
    studentId: Types.ObjectId;
    recordId: Types.ObjectId;
    academicYear: string | null;
    receiptNo: string;
    paymentDate: Date;
    paymentMode: "cash" | "upi" | "cheque" | "bank_transfer";
    amountPaid: number;
    allocation: IFeeHeadAllocation[];
    cashDenominations: IDenomination[];
    proofUpload: ITransactionUpload[];
    referenceNumber?: string;
    bankName?: string;
    chequeDate?: string;
    collectedBy: Types.ObjectId;
    remarks?: string;
    status: "success" | "cancelled" | "bounced" | "pending" | "draft";
    createdAt: Date;
    updatedAt: Date;
}

const denominationSchema = new mongoose.Schema<IDenomination>({
    label: { type: String }, // "500", "200", "100"
    count: { type: Number, default: 0 }
}, { _id: false });


const feeHeads = new Schema<IFeeHeadAllocation>({
    feeHead: { type: String, default: null },
    amount: { type: Number, default: 0 }
}, { _id: true })



const uploadSchema = new Schema<ITransactionUpload>({
    type: { type: String, enum: ["image", "pdf", "video"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, { _id: true });

const FeeTransactionSchema = new mongoose.Schema<IFeeTransaction>({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolModel", },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentNewModel", },
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentRecord", }, // The Year Ledger
    academicYear: { type: String, default: null },

    receiptNo: { type: String, }, // REC-2025-001

    paymentDate: { type: Date, default: new Date() },
    paymentMode: { type: String, enum: ["cash", "upi", "cheque", "bank_transfer"], },

    amountPaid: { type: Number, },

    // The Allocation (Snapshot of what this receipt paid for)
    allocation: {  
        type: [feeHeads], default: []
    },

    // Cash Denominations (Array of Objects as requested)
    cashDenominations: {
        type: [denominationSchema],
        default: []
    },

    proofUpload : {type: [uploadSchema], default: []},

    // Cheque / UPI Details
    referenceNumber: { type: String },
    bankName: { type: String },
    chequeDate: { type: String },

    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserModel" },
    remarks: { type: String },

    status: { type: String, enum: ["success", "cancelled", "bounced", "pending", "draft"], default: "success" }

}, { timestamps: true });


FeeTransactionSchema.index({
    schoolId: 1,
    studentId: 1,
    recordId: 1
});

const FeeTransactionModel = mongoose.model('FeeTransactionModel', FeeTransactionSchema);

export default FeeTransactionModel
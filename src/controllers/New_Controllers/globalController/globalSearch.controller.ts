// controllers/globalSearch.controller.ts
import { type Request, type Response } from 'express';
import mongoose, { Model } from 'mongoose';
import StudentNewModel from '../../../models/New_Model/StudentModel/studentNew.model.js';
import FeeTransactionModel from '../../../models/New_Model/FeeTransactionReceipt_model/feeTransactionReceipt.model.js';
import BillBookRecordModel from '../../../models/New_Model/SchoolModel/billBook_model/BillRecord.model.js';
import type { RoleBasedRequest } from '../../../utils/types.js';
import AdmissionFormModel from '../../../models/New_Model/SchoolModel/admission_model/admissionForm.model.js';
import { ExpenseModel } from '../../../models/New_Model/expense_model/expense.model.js';

// ---------- Types ----------

interface SearchResult {
    type: string;
    _id: string;
    uniqueId: string;
    title: string;
    subtitle?: string;
    path: string;
    icon: string;
}

interface SearchableConfig<T> {
    type: string;
    model: Model<T>;
    // fields to run the regex against (unique numbers + name-ish fields)
    searchFields: (keyof T & string)[];
    // fields to actually pull from mongo
    selectFields: string;
    // populate needed to resolve a name for display (e.g. FeeTransaction -> studentId.studentName)
    populate?: { path: string; select: string }[];
    icon: string;
    // turns a lean doc into the normalized result shape
    mapResult: (doc: any) => SearchResult;
}

// ---------- Registry ----------
// 👉 To add model #16: add one entry here. Nothing else changes.

const SEARCH_REGISTRY: SearchableConfig<any>[] = [
    {
        type: 'student',
        model: StudentNewModel,
        searchFields: ['srId', 'studentName'],
        selectFields: '_id srId studentName class section',
        icon: 'fa-solid fa-user-graduate',
        mapResult: (s) => ({
            type: 'student',
            _id: s._id.toString(),
            uniqueId: s.srId,
            title: s.studentName,
            subtitle: `SR: ${s.srId}${s.class ? ` · ${s.class}-${s.section ?? ''}` : ''}`,
            // path: `/students/${s._id}`,
            path: `/dashboard/student/profile/${s._id}`,
            icon: 'fa-solid fa-user-graduate',
        }),
    },
    {
        type: 'fee_receipt',
        model: FeeTransactionModel,
        searchFields: ['receiptNo', 'billNo'],
        selectFields: '_id receiptNo billNo studentId',
        populate: [{ path: 'studentId', select: 'studentName srId' }],
        icon: 'fa-solid fa-receipt',
        mapResult: (r) => ({
            type: 'fee_receipt',
            _id: r._id.toString(),
            uniqueId: r.receiptNo,
            title: `Receipt ${r.receiptNo}`,
            subtitle: r.studentId?.studentName ? `${r.studentId.studentName} (${r.studentId.srId})` : "",
            // path: `/dashboard/student-record/single/${r.studentId._id}/fee-transaction/${r._id}`,
            path: `/dashboard/student-record/single/${r.studentId._id}/fee-transaction?receiptId=${r._id}`,
            icon: 'fa-solid fa-receipt',
        }),
    },
    {
        type: 'bill_record',
        model: BillBookRecordModel,
        searchFields: ['billNumber'],
        selectFields: '_id billNumber studentId billBookId',
        populate: [{ path: 'studentId', select: 'studentName srId' }],
        icon: 'fa-solid fa-file-invoice',
        mapResult: (b) => ({
            type: 'bill_record',
            _id: b._id.toString(),
            uniqueId: b.billNumber,
            title: `Bill ${b.billNumber}`,
            subtitle: b.studentId?.studentName ?? undefined,
            // path: `/dashboard/school?type=billrecord${b._id}`,
            path: `/dashboard/school?type=billrecord&billBookId=${b.billBookId}`,
            icon: 'fa-solid fa-file-invoice',
        }),
    },
    // Next model example (just uncomment/adapt when ready):
    // 🌟 Bill No. #1 — manual bill number stored ON the fee transaction itself
    // {
    //     type: 'fee_transaction_bill',
    //     model: FeeTransactionModel,
    //     searchFields: ['billNo'],
    //     selectFields: '_id receiptNo billNo studentId',
    //     populate: [{ path: 'studentId', select: 'studentName srId' }],
    //     icon: 'fa-solid fa-receipt',
    //     mapResult: (r) => ({
    //         type: 'fee_transaction_bill',
    //         _id: r._id.toString(),
    //         uniqueId: r.billNo,
    //         title: `Bill ${r.billNo}`,
    //         subtitle: `Fee Receipt · ${r.studentId?.studentName ?? 'Unknown'}`, // 👈 disambiguation label
    //         path: `/fee-receipts/${r._id}`, // same target as receipt — it's the same transaction doc
    //         icon: 'fa-solid fa-receipt',
    //     }),
    // },

    // 🌟 Bill No. #2 — finalized bill number in the separate BillBookRecordModel
    // {
    //     type: 'bill_record',
    //     model: BillBookRecordModel,
    //     searchFields: ['billNumber'],
    //     selectFields: '_id billNumber studentId feeReceiptId',
    //     populate: [{ path: 'studentId', select: 'studentName srId' }],
    //     icon: 'fa-solid fa-file-invoice',
    //     mapResult: (b) => ({
    //         type: 'bill_record',
    //         _id: b._id.toString(),
    //         uniqueId: b.billNumber,
    //         title: `Bill ${b.billNumber}`,
    //         subtitle: `Bill Book · ${b.studentId?.studentName ?? 'Unknown'}`, // 👈 disambiguation label
    //         path: `/bill-records/${b._id}`, // needs to change — this is its own model/route
    //         icon: 'fa-solid fa-file-invoice',
    //     }),
    // },

    // 🌟 NEW — Admission form, path branches on whether it's still an application or already a student
    {
        type: 'admission_form',
        model: AdmissionFormModel,
        searchFields: ['formNumber'],
        selectFields: '_id formNumber studentId admissionBookId',
        icon: 'fa-solid fa-file-signature',
        mapResult: (a) => {
            const isAdmitted = !!a.studentId;
            return {
                type: 'admission_form',
                _id: a._id.toString(),
                uniqueId: a.formNumber,
                title: `Admission Form ${a.formNumber}`,
                subtitle: isAdmitted ? 'Admitted · view student profile' : 'Application pending',
                // 👇 if the form has converted into a student, send them straight to the student
                // path: isAdmitted ? `/students/${a.studentId}` : `/admission-forms/${a._id}`,
                // path: isAdmitted ? `/students/${a.studentId}` : `/dashboard/school?type=admissionbook}`,
                path: `/dashboard/school?type=admissionbook&admissionBookId=${a.admissionBookId}&admissionFormId=${a._id}`,

                icon: isAdmitted ? 'fa-solid fa-user-graduate' : 'fa-solid fa-file-signature',
            };
        },
    },
    {
        type: 'expense',
        model: ExpenseModel,
        searchFields: ['expenseNo'],
        selectFields: '_id expenseNo amount category', // adjust selectFields to whatever fields exist on IExpense
        icon: 'fa-solid fa-money-bill-wave',
        mapResult: (e) => ({
            type: 'expense',
            _id: e._id.toString(),
            uniqueId: e.expenseNo,
            title: `Expense ${e.expenseNo}`,
            subtitle: e.category ? `${e.category}${e.amount ? ` · ₹${e.amount}` : ''}` : "",
            path: `/dashboard/expense/single/${e._id}`,
            icon: 'fa-solid fa-money-bill-wave',
        }),
    }
];

const LIMIT_PER_TYPE = 5;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Controller ----------

export const globalSearchController = async (req: RoleBasedRequest, res: Response) => {
    try {
        const q = (req.query.q as string) || '';
        const trimmed = q.trim();

        if (trimmed.length < 2) {
            return res.json({ ok: true, results: [] });
        }

        const schoolId = req.query.schoolId as mongoose.Types.ObjectId;
        if (!schoolId) {
            return res.status(401).json({ ok: false, message: 'Unauthorized' });
        }

        const prefixRegex = new RegExp(`^${escapeRegex(trimmed)}`, 'i');

        const queries = SEARCH_REGISTRY.map(async (config) => {
            const orClause = config.searchFields.map((field) => ({
                [field]: prefixRegex,
            }));

            let query = config.model
                .find({ schoolId, $or: orClause })
                .select(config.selectFields)
                .limit(LIMIT_PER_TYPE);

            if (config.populate) {
                config.populate.forEach((p) => {
                    query = query.populate(p.path, p.select) as typeof query;
                });
            }

            const docs = await query.lean();
            return docs.map((doc) => config.mapResult(doc));
        });

        const resultsByType = await Promise.all(queries);
        const results: SearchResult[] = resultsByType.flat();

        return res.json({ ok: true, data: results, message: "global search data fetched successfully" });
    } catch (err) {
        console.error('globalSearchController error:', err);
        return res.status(500).json({ ok: false, message: 'Search failed' });
    }
};
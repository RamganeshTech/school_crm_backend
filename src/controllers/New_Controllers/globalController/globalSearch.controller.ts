// // controllers/globalSearch.controller.ts
// import { type Request, type Response } from 'express';
// import mongoose, { Model } from 'mongoose';
// import StudentNewModel from '../../../models/New_Model/StudentModel/studentNew.model.js';
// import FeeTransactionModel from '../../../models/New_Model/FeeTransactionReceipt_model/feeTransactionReceipt.model.js';
// import BillBookRecordModel from '../../../models/New_Model/SchoolModel/billBook_model/BillRecord.model.js';
// import type { RoleBasedRequest } from '../../../utils/types.js';
// import AdmissionFormModel from '../../../models/New_Model/SchoolModel/admission_model/admissionForm.model.js';
// import { ExpenseModel } from '../../../models/New_Model/expense_model/expense.model.js';

// // ---------- Types ----------

// interface SearchResult {
//     type: string;
//     _id: string;
//     uniqueId: string;
//     title: string;
//     subtitle?: string;
//     path: string;
//     icon: string;
// }

// interface SearchableConfig<T> {
//     type: string;
//     model: Model<T>;
//     // fields to run the regex against (unique numbers + name-ish fields)
//     searchFields: (keyof T & string)[];
//     // fields to actually pull from mongo
//     selectFields: string;
//     // populate needed to resolve a name for display (e.g. FeeTransaction -> studentId.studentName)
//     populate?: { path: string; select: string }[];
//     icon: string;
//     // turns a lean doc into the normalized result shape
//     mapResult: (doc: any) => SearchResult;
// }

// // ---------- Registry ----------
// // 👉 To add model #16: add one entry here. Nothing else changes.

// const SEARCH_REGISTRY: SearchableConfig<any>[] = [
//     {
//         type: 'student',
//         model: StudentNewModel,
//         searchFields: ['srId', 'studentName'],
//         selectFields: '_id srId studentName class section',
//         icon: 'fa-solid fa-user-graduate',
//         mapResult: (s) => ({
//             type: 'student',
//             _id: s._id.toString(),
//             uniqueId: s.srId,
//             title: s.studentName,
//             subtitle: `SR: ${s.srId}${s.class ? ` · ${s.class}-${s.section ?? ''}` : ''}`,
//             // path: `/students/${s._id}`,
//             path: `/dashboard/student/profile/${s._id}`,
//             icon: 'fa-solid fa-user-graduate',
//         }),
//     },
//     {
//         type: 'fee_receipt',
//         model: FeeTransactionModel,
//         searchFields: ['receiptNo', 'billNo'],
//         selectFields: '_id receiptNo billNo studentId',
//         populate: [{ path: 'studentId', select: 'studentName srId' }],
//         icon: 'fa-solid fa-receipt',
//         mapResult: (r) => ({
//             type: 'fee_receipt',
//             _id: r._id.toString(),
//             uniqueId: r.receiptNo,
//             title: `Receipt ${r.receiptNo}`,
//             subtitle: r.studentId?.studentName ? `${r.studentId.studentName} (${r.studentId.srId})` : "",
//             // path: `/dashboard/student-record/single/${r.studentId._id}/fee-transaction/${r._id}`,
//             path: `/dashboard/student-record/single/${r.studentId._id}/fee-transaction?receiptId=${r._id}`,
//             icon: 'fa-solid fa-receipt',
//         }),
//     },
//     {
//         type: 'bill_record',
//         model: BillBookRecordModel,
//         searchFields: ['billNumber'],
//         selectFields: '_id billNumber studentId billBookId',
//         populate: [{ path: 'studentId', select: 'studentName srId' }],
//         icon: 'fa-solid fa-file-invoice',
//         mapResult: (b) => ({
//             type: 'bill_record',
//             _id: b._id.toString(),
//             uniqueId: b.billNumber,
//             title: `Bill ${b.billNumber}`,
//             subtitle: b.studentId?.studentName ?? undefined,
//             // path: `/dashboard/school?type=billrecord${b._id}`,
//             path: `/dashboard/school?type=billrecord&billBookId=${b.billBookId}`,
//             icon: 'fa-solid fa-file-invoice',
//         }),
//     },
//     // Next model example (just uncomment/adapt when ready):
//     // 🌟 Bill No. #1 — manual bill number stored ON the fee transaction itself
//     // {
//     //     type: 'fee_transaction_bill',
//     //     model: FeeTransactionModel,
//     //     searchFields: ['billNo'],
//     //     selectFields: '_id receiptNo billNo studentId',
//     //     populate: [{ path: 'studentId', select: 'studentName srId' }],
//     //     icon: 'fa-solid fa-receipt',
//     //     mapResult: (r) => ({
//     //         type: 'fee_transaction_bill',
//     //         _id: r._id.toString(),
//     //         uniqueId: r.billNo,
//     //         title: `Bill ${r.billNo}`,
//     //         subtitle: `Fee Receipt · ${r.studentId?.studentName ?? 'Unknown'}`, // 👈 disambiguation label
//     //         path: `/fee-receipts/${r._id}`, // same target as receipt — it's the same transaction doc
//     //         icon: 'fa-solid fa-receipt',
//     //     }),
//     // },

//     // 🌟 Bill No. #2 — finalized bill number in the separate BillBookRecordModel
//     // {
//     //     type: 'bill_record',
//     //     model: BillBookRecordModel,
//     //     searchFields: ['billNumber'],
//     //     selectFields: '_id billNumber studentId feeReceiptId',
//     //     populate: [{ path: 'studentId', select: 'studentName srId' }],
//     //     icon: 'fa-solid fa-file-invoice',
//     //     mapResult: (b) => ({
//     //         type: 'bill_record',
//     //         _id: b._id.toString(),
//     //         uniqueId: b.billNumber,
//     //         title: `Bill ${b.billNumber}`,
//     //         subtitle: `Bill Book · ${b.studentId?.studentName ?? 'Unknown'}`, // 👈 disambiguation label
//     //         path: `/bill-records/${b._id}`, // needs to change — this is its own model/route
//     //         icon: 'fa-solid fa-file-invoice',
//     //     }),
//     // },

//     // 🌟 NEW — Admission form, path branches on whether it's still an application or already a student
//     {
//         type: 'admission_form',
//         model: AdmissionFormModel,
//         searchFields: ['formNumber'],
//         selectFields: '_id formNumber studentId admissionBookId',
//         icon: 'fa-solid fa-file-signature',
//         mapResult: (a) => {
//             const isAdmitted = !!a.studentId;
//             return {
//                 type: 'admission_form',
//                 _id: a._id.toString(),
//                 uniqueId: a.formNumber,
//                 title: `Admission Form ${a.formNumber}`,
//                 subtitle: isAdmitted ? 'Admitted · view student profile' : 'Application pending',
//                 // 👇 if the form has converted into a student, send them straight to the student
//                 // path: isAdmitted ? `/students/${a.studentId}` : `/admission-forms/${a._id}`,
//                 // path: isAdmitted ? `/students/${a.studentId}` : `/dashboard/school?type=admissionbook}`,
//                 path: `/dashboard/school?type=admissionbook&admissionBookId=${a.admissionBookId}&admissionFormId=${a._id}`,

//                 icon: isAdmitted ? 'fa-solid fa-user-graduate' : 'fa-solid fa-file-signature',
//             };
//         },
//     },
//     {
//         type: 'expense',
//         model: ExpenseModel,
//         searchFields: ['expenseNo'],
//         selectFields: '_id expenseNo amount category', // adjust selectFields to whatever fields exist on IExpense
//         icon: 'fa-solid fa-money-bill-wave',
//         mapResult: (e) => ({
//             type: 'expense',
//             _id: e._id.toString(),
//             uniqueId: e.expenseNo,
//             title: `Expense ${e.expenseNo}`,
//             subtitle: e.category ? `${e.category}${e.amount ? ` · ₹${e.amount}` : ''}` : "",
//             path: `/dashboard/expense/single/${e._id}`,
//             icon: 'fa-solid fa-money-bill-wave',
//         }),
//     }
// ];

// const LIMIT_PER_TYPE = 5;

// const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// // ---------- Controller ----------

// export const globalSearchController = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const q = (req.query.q as string) || '';
//         const trimmed = q.trim();

//         if (trimmed.length < 2) {
//             return res.json({ ok: true, results: [] });
//         }

//         const schoolId = req.query.schoolId as mongoose.Types.ObjectId;
//         if (!schoolId) {
//             return res.status(401).json({ ok: false, message: 'Unauthorized' });
//         }

//         const prefixRegex = new RegExp(`^${escapeRegex(trimmed)}`, 'i');

//         const queries = SEARCH_REGISTRY.map(async (config) => {
//             const orClause = config.searchFields.map((field) => ({
//                 [field]: prefixRegex,
//             }));

//             let query = config.model
//                 .find({ schoolId, $or: orClause })
//                 .select(config.selectFields)
//                 .limit(LIMIT_PER_TYPE);

//             if (config.populate) {
//                 config.populate.forEach((p) => {
//                     query = query.populate(p.path, p.select) as typeof query;
//                 });
//             }

//             const docs = await query.lean();
//             return docs.map((doc) => config.mapResult(doc));
//         });

//         const resultsByType = await Promise.all(queries);
//         const results: SearchResult[] = resultsByType.flat();

//         return res.json({ ok: true, data: results, message: "global search data fetched successfully" });
//     } catch (err) {
//         console.error('globalSearchController error:', err);
//         return res.status(500).json({ ok: false, message: 'Search failed' });
//     }
// };




// controllers/globalSearch.controller.ts
import { type Request, type Response } from 'express';
import mongoose, { Model } from 'mongoose';
import StudentNewModel from '../../../models/New_Model/StudentModel/studentNew.model.js';
import FeeTransactionModel from '../../../models/New_Model/FeeTransactionReceipt_model/feeTransactionReceipt.model.js';
import BillBookRecordModel from '../../../models/New_Model/SchoolModel/billBook_model/BillRecord.model.js';
import type { RoleBasedRequest } from '../../../utils/types.js';
import AdmissionFormModel from '../../../models/New_Model/SchoolModel/admission_model/admissionForm.model.js';
import { ExpenseModel } from '../../../models/New_Model/expense_model/expense.model.js';
import { FinanceLedgerModel } from '../../../models/New_Model/financeLedger_model/financeLedger.model.js';
import StudentRecordModel from '../../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js';

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

// 👉 NEW: describes a "also fetch these related records" step attached to a registry entry.
// Example: when a `student` doc matches, use its _id to also pull FeeTransaction, BillBookRecord, etc.
interface LinkedLookup {
    type: string;
    model: Model<any>;
    foreignField: string; // field on the RELATED model that points back to the source doc's _id

    // 👉 NEW: Optional bridge to hop through another model first
    intermediate?: {
        model: Model<any>;
        matchField: string;   // e.g., 'studentId' on StudentRecordModel
        extractField: string; // e.g., '_id' from StudentRecordModel
    };

    selectFields: string;
    populate?: { path: string; select: string }[];
    icon: string;
    mapResult: (doc: any) => SearchResult;
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
    // 👉 NEW: optional — related records to fetch once THIS config's docs are found
    linkedLookups?: LinkedLookup[];
}

// ---------- Registry ----------
// 👉 To add model #16: add one entry here. Nothing else changes.
// 👉 To make a model "pull in" related records when it matches: add a `linkedLookups` array to it.

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
            path: `/dashboard/student/profile/${s._id}`,
            icon: 'fa-solid fa-user-graduate',
        }),
        // 👇 NEW: when a student is matched (by name or srId), also go find their
        // fee receipts, bill records, admission form, and finance ledger entries.
        linkedLookups: [
            {
                type: 'fee_receipt',
                model: FeeTransactionModel,
                foreignField: 'studentId',
                selectFields: '_id receiptNo billNo studentId',
                populate: [{ path: 'studentId', select: 'studentName srId _id' }],
                icon: 'fa-solid fa-receipt',
                mapResult: (r) => ({
                    type: 'fee_receipt',
                    _id: r._id.toString(),
                    uniqueId: r.receiptNo,
                    title: `Receipt ${r.receiptNo}`,
                    subtitle: r.studentId?.studentName ? `${r.studentId.studentName} (${r.studentId.srId})` : "",
                    path: `/dashboard/student-record/single/${r.studentId._id}/fee-transaction?receiptId=${r._id}`,
                    icon: 'fa-solid fa-receipt',
                }),
            },
            {
                type: 'bill_record',
                model: BillBookRecordModel,
                foreignField: 'studentId',
                selectFields: '_id billNumber studentId billBookId',
                populate: [{ path: 'studentId', select: 'studentName srId _id' }],
                icon: 'fa-solid fa-file-invoice',
                mapResult: (b) => ({
                    type: 'bill_record',
                    _id: b._id.toString(),
                    uniqueId: b.billNumber,
                    title: `Bill ${b.billNumber}`,
                    subtitle: b.studentId?.studentName ?? undefined,
                    path: `/dashboard/school?type=billrecord&billBookId=${b.billBookId}`,
                    icon: 'fa-solid fa-file-invoice',
                }),
            },
            {
                type: 'admission_form',
                model: AdmissionFormModel,
                foreignField: 'studentId',
                selectFields: '_id formNumber studentId admissionBookId',
                icon: 'fa-solid fa-file-signature',
                mapResult: (a) => ({
                    type: 'admission_form',
                    _id: a._id.toString(),
                    uniqueId: a.formNumber,
                    title: `Admission Form ${a.formNumber}`,
                    subtitle: 'Admitted · view student profile',
                    path: `/dashboard/school?type=admissionbook&admissionBookId=${a.admissionBookId}&admissionFormId=${a._id}`,
                    icon: 'fa-solid fa-user-graduate',
                }),
            },
            {
                type: 'finance_ledger',
                model: FinanceLedgerModel,
                foreignField: 'studentRecordId',

                // 👇 NEW: Tells the controller to get StudentRecords for these students first!
                intermediate: {
                    model: StudentRecordModel,
                    matchField: 'studentId', // Matches the student._id we just found
                    extractField: '_id'      // Pulls the studentRecord._id to feed into FinanceLedgerModel
                },

                selectFields: '_id category amount transactionType date status referenceModel',
                icon: 'fa-solid fa-book',
                mapResult: (l) => ({
                    type: 'finance_ledger',
                    _id: l._id.toString(),
                    uniqueId: l._id.toString(),
                    title: `Finance Ledger: ${l.category ?? 'Ledger Entry'}${l.amount ? ` · ₹${l.amount}` : ''}`,
                    subtitle: `${l.transactionType ?? ''}${l.status ? ` · ${l.status}` : ''}`,
                    path: `/dashboard/finance/ledger/${l._id}`, // 👈 adjust to your real ledger detail route
                    icon: 'fa-solid fa-book',
                }),
            },
        ],
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
            path: `/dashboard/student-record/single/${r.studentId._id}/fee-transaction?receiptId=${r._id}`,
            icon: 'fa-solid fa-receipt',
        }),
        // 👇 NEW: when a receipt/bill-no is matched directly, also pull its ledger entry
        linkedLookups: [
            {
                type: 'finance_ledger',
                model: FinanceLedgerModel,
                foreignField: 'feeReceiptId', // 👈 change to 'referenceId' if that's what your fee code actually sets
                selectFields: '_id category amount transactionType date status referenceModel',
                icon: 'fa-solid fa-book',
                mapResult: (l) => ({
                    type: 'finance_ledger',
                    _id: l._id.toString(),
                    uniqueId: l._id.toString(),
                    title: `Finance Ledger: ${l.category ?? 'Ledger Entry'}${l.amount ? ` · ₹${l.amount}` : ''}`,
                    subtitle: `${l.transactionType ?? ''}${l.status ? ` · ${l.status}` : ''}`,
                    path: `/dashboard/finance?ledgerId=${l._id}`,
                    icon: 'fa-solid fa-book',
                }),
            },
        ],
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
            path: `/dashboard/school?type=billrecord&billBookId=${b.billBookId}`,
            icon: 'fa-solid fa-file-invoice',
        }),
    },
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
                path: `/dashboard/school?type=admissionbook&admissionBookId=${a.admissionBookId}&admissionFormId=${a._id}`,
                icon: isAdmitted ? 'fa-solid fa-user-graduate' : 'fa-solid fa-file-signature',
            };
        },
    },
    {
        type: 'expense',
        model: ExpenseModel,
        searchFields: ['expenseNo'],
        selectFields: '_id expenseNo amount category',
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
        // 👇 NEW: when an expense is matched directly, also pull its ledger entry
        linkedLookups: [
            {
                type: 'finance_ledger',
                model: FinanceLedgerModel,
                foreignField: 'referenceId',
                selectFields: '_id category amount transactionType date status referenceModel',
                icon: 'fa-solid fa-book',
                mapResult: (l) => ({
                    type: 'finance_ledger',
                    _id: l._id.toString(),
                    uniqueId: l._id.toString(),
                    title: `Finance Ledger: ${l.category ?? 'Ledger Entry'}${l.amount ? ` · ₹${l.amount}` : ''}`,
                    subtitle: `${l.transactionType ?? ''}${l.status ? ` · ${l.status}` : ''}`,
                    path: `/dashboard/finance/ledger/${l._id}`,
                    icon: 'fa-solid fa-book',
                }),
            },
        ],
    },
    // 👉 NOTE: FinanceLedgerModel is NOT in this top-level registry as its own direct-search entry
    // (it has no natural "number" field a user would type to search for it directly).
    // It only shows up as a linkedLookup result attached to student / fee_receipt / expense above.
    // If you DO want people to be able to search ledger entries directly (e.g. by a ledger reference
    // number, once you add one), just add a normal entry here like the others.
];

const LIMIT_PER_TYPE = 20;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Controller ----------

export const globalSearchController = async (req: RoleBasedRequest, res: Response) => {
    try {
        const q = (req.query.q as string) || '';
        const trimmed = q.trim();

        const testLedger = await FinanceLedgerModel.findOne().sort({ createdAt: -1 }).lean();
        console.log("\n[DEBUG] LATEST LEDGER ENTRY IN DB:", testLedger);

        if (trimmed.length < 2) {
            return res.json({ ok: true, results: [] });
        }

        const schoolId = req.query.schoolId as mongoose.Types.ObjectId;
        if (!schoolId) {
            return res.status(401).json({ ok: false, message: 'Unauthorized' });
        }

        const prefixRegex = new RegExp(`^${escapeRegex(trimmed)}`, 'i');

        // ---------- Pass 1: direct search (unchanged behavior) ----------
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
            const mapped = docs.map((doc) => config.mapResult(doc));
            // keep the raw docs around too — pass 2 needs their _ids
            return { config, docs, mapped };
        });

        const directResults = await Promise.all(queries);
        const results: SearchResult[] = directResults.flatMap((r) => r.mapped);

        // dedupe key so a linked lookup never re-adds something already found directly
        const seen = new Set(results.map((r) => `${r.type}:${r._id}`));

        // ---------- Pass 2: linked lookups ----------
        // For every direct hit that has `linkedLookups` configured, use the matched
        // doc's _id to go fetch related records from other models.
        const linkedQueries: Promise<SearchResult[]>[] = [];

        for (const { config, docs } of directResults) {
            if (!config.linkedLookups || docs.length === 0) continue;

            // const sourceIds = docs.map((d: any) => d._id);
            const sourceIds = docs.map((d: any) => d._id.toString());

            for (const lookup of config.linkedLookups) {
                linkedQueries.push(
                    (async () => {

                        let targetIds = sourceIds;
                        const safeSchoolId = schoolId.toString(); // 🌟 FIX 2: Force schoolId to string

                        // 👇 NEW: Handle the intermediate jump (Student -> StudentRecord -> Ledger)
                        if (lookup.intermediate) {
                            console.log(`\n[DEBUG] --- Starting intermediate lookup for: ${lookup.type} ---`);
                            console.log(`[DEBUG] 1. sourceIds (Student IDs):`, sourceIds);

                            const extractField = lookup.intermediate.extractField;
                            const intermediateDocs = await lookup.intermediate.model
                                .find({ schoolId, [lookup.intermediate.matchField]: { $in: sourceIds } })
                                .select(extractField)
                                .lean();

                            console.log(`[DEBUG] 2. Found ${intermediateDocs.length} intermediate docs (StudentRecords):`, intermediateDocs);

                            // targetIds = intermediateDocs.map((d: any) => d[extractField]);
                            targetIds = intermediateDocs.map((d: any) => d[extractField].toString());
                            console.log(`[DEBUG] 3. Mapped targetIds (StudentRecord IDs):`, targetIds);

                            if (targetIds.length === 0) {
                                console.log(`[DEBUG] ❌ No targetIds found! Stopping here for ${lookup.type}.`);
                                return [];
                            }
                        }

                        // Run final query
                        console.log(`[DEBUG] 4. Querying final model (${lookup.model.modelName}) with field "${lookup.foreignField}" for IDs:`, targetIds);

                        // let q = lookup.model
                        //     .find({ schoolId, [lookup.foreignField]: { $in: sourceIds } })
                        //     .select(lookup.selectFields)
                        //     .limit(LIMIT_PER_TYPE);

                        let q = lookup.model
                            .find({ 
                                schoolId: safeSchoolId, 
                                [lookup.foreignField]: { $in: targetIds } 
                            })
                            .select(lookup.selectFields)
                            .limit(LIMIT_PER_TYPE);

                        if (lookup.populate) {
                            lookup.populate.forEach((p) => {
                                q = q.populate(p.path, p.select) as typeof q;
                            });
                        }

                        const linkedDocs = await q.lean();
                        console.log(`[DEBUG] 5. ✅ Found ${linkedDocs.length} final linked docs for ${lookup.type}.`);
                        return linkedDocs
                            .map((doc: any) => lookup.mapResult(doc))
                            .filter((r) => {
                                const key = `${r.type}:${r._id}`;
                                if (seen.has(key)) return false;
                                seen.add(key);
                                return true;
                            });
                    })()
                );
            }
        }

        const linkedResultsByLookup = await Promise.all(linkedQueries);
        results.push(...linkedResultsByLookup.flat());

        return res.json({ ok: true, data: results, message: "global search data fetched successfully" });
    } catch (err) {
        console.error('globalSearchController error:', err);
        return res.status(500).json({ ok: false, message: 'Search failed' });
    }
};
// // scripts/backfillFinanceLedger.ts
// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// import { FinanceLedgerModel } from './models/New_Model/financeLedger_model/financeLedger.model.js';

// dotenv.config();

// const TARGET_SCHOOL_ID = '6a44c42df10702c8f6c1106f';
// const MONGO_URI = process.env.MONGODB_CONNECTIONSTRING 

// async function runMigration() {
//     try {
//         console.log('[MIGRATION] Connecting to Database...');
//         if(!MONGO_URI) throw new Error("env var not avaialble ")

//         await mongoose.connect(MONGO_URI);
//         console.log('[MIGRATION] Connected successfully.');

//         const schoolObjectId = new mongoose.Types.ObjectId(TARGET_SCHOOL_ID);

//         // Fetch all records for this specific school sorted chronologically
//         const records = await FinanceLedgerModel.find({
//             schoolId: schoolObjectId,
//             $or: [
//                 { referenceNo: { $exists: false } },
//                 { referenceNo: null },
//                 { referenceNo: '' }
//             ]
//         }).sort({ date: 1, createdAt: 1 });

//         console.log(`[MIGRATION] Found ${records.length} records to backfill for School ID: ${TARGET_SCHOOL_ID}`);

//         if (records.length === 0) {
//             console.log('[MIGRATION] No records found needing updates.');
//             process.exit(0);
//         }

//         // Track running sequence counter per year
//         const yearSequences: Record<number, number> = {};

//         for (const record of records) {
//             const recordDate = record.date || (record as any).createdAt || new Date();
//             const year = new Date(recordDate).getFullYear();
//             const prefix = `FL-${year}-`;

//             // Initialize counter for the year if not already in memory
//             if (yearSequences[year] === undefined) {
//                 // Check if any record in this year already had a valid reference number
//                 const latestInYear = await FinanceLedgerModel.findOne({
//                     schoolId: schoolObjectId,
//                     referenceNo: { $regex: new RegExp(`^${prefix}`) }
//                 })
//                 .sort({ referenceNo: -1 })
//                 .select('referenceNo')
//                 .lean();

//                 let currentSeq = 0;
//                 if (latestInYear?.referenceNo) {
//                     const parts = latestInYear.referenceNo.split('-');
//                     const parsed = parseInt(parts[2] || '0', 10);
//                     if (!isNaN(parsed)) currentSeq = parsed;
//                 }
//                 yearSequences[year] = currentSeq;
//             }

//             // Increment sequence (001, 002, ..., 1000)
//             yearSequences[year] += 1;
//             const seq = yearSequences[year];
//             const formattedSeq = seq < 1000 ? String(seq).padStart(3, '0') : String(seq);
//             const generatedRefNo = `${prefix}${formattedSeq}`;

//             // Update directly in DB (bypasses pre-save hooks safely)
//             await FinanceLedgerModel.updateOne(
//                 { _id: record._id },
//                 { $set: { referenceNo: generatedRefNo } }
//             );

//             console.log(`[MIGRATION] Updated Record ID ${record._id} -> ${generatedRefNo}`);
//         }

//         console.log('\n[MIGRATION] Done! All ledger reference numbers backfilled successfully.');
//         process.exit(0);
//     } catch (error) {
//         console.error('[MIGRATION] Fatal error running migration:', error);
//         process.exit(1);
//     }
// }

// runMigration();
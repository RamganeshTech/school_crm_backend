import cron from "node-cron";
import mongoose from "mongoose";
import SchoolModel from "../../models/New_Model/SchoolModel/schoolModel.model.js";
import FeeStructureConfigModel from "../../models/New_Model/FeeStructureModel/feeStructureConfig.model.js";
import StudentRecordModel from "../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js";
import { computeFeeStatus } from "../../controllers/New_Controllers/studentRecord_controller/studentRecord.controller.js";

/**
 * Finds schools where ANY term (firstTerm/secondTerm/thirdTerm) starts "today"
 * (date-only comparison, ignoring time-of-day).
 */
const findSchoolsWithTermStartingToday = async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // We need schools where at least one academicTermDates entry has
    // firstTerm/secondTerm/thirdTerm falling within today's date range.
    const schools = await SchoolModel.find({
        academicTermDates: {
            $elemMatch: {
                $or: [
                    { firstTerm: { $gte: startOfDay, $lte: endOfDay } },
                    { secondTerm: { $gte: startOfDay, $lte: endOfDay } },
                    { thirdTerm: { $gte: startOfDay, $lte: endOfDay } },
                ],
            },
        },
    }).lean();

    return schools;
};

/**
 * For a given school + the academicYear entry that triggered the match,
 * recompute feeStatus for all active StudentRecords under that school+year,
 * and persist via a single bulkWrite.
 */
const recomputeForSchool = async (schoolDoc: any, academicYear: string) => {
    const feeConfig = await FeeStructureConfigModel.findOne({ schoolId: schoolDoc._id }).lean();
    if (!feeConfig || !feeConfig.feeHeads || feeConfig.feeHeads.length === 0) {
        console.warn(`[FeeStatus Cron] Skipping school ${schoolDoc._id} — no FeeStructureConfig found.`);
        return { schoolId: schoolDoc._id, matched: 0, updated: 0 };
    }

    // Only pull the fields we actually need — keeps memory light for big schools
    const studentRecords = await StudentRecordModel.find(
        { schoolId: schoolDoc._id, academicYear, isActive: true },
        { duesv1: 1, feeStatus: 1 }
    ).lean();

    if (studentRecords.length === 0) {
        return { schoolId: schoolDoc._id, matched: 0, updated: 0 };
    }

    const bulkOps: any[] = [];

    for (const record of studentRecords) {
        const newStatus = computeFeeStatus(
            feeConfig.feeHeads,
            record.duesv1,
            schoolDoc.academicTermDates,
            academicYear
        );

        // Only write if the status actually changed — avoids needless writes
        if (newStatus !== record.feeStatus) {
            bulkOps.push({
                updateOne: {
                    filter: { _id: record._id },
                    update: { $set: { feeStatus: newStatus } },
                },
            });
        }
    }

    if (bulkOps.length > 0) {
        await StudentRecordModel.bulkWrite(bulkOps, { ordered: false });
    }

    return { schoolId: schoolDoc._id, matched: studentRecords.length, updated: bulkOps.length };
};

/**
 * Main job entrypoint — finds today's "term start" schools, and for each,
 * recomputes feeStatus only for the specific academicYear whose term
 * actually matched today (a school can have multiple years in academicTermDates,
 * but only the current one matters operationally — adjust if you need historical years too).
 */
export const runFeeStatusRecomputeJob = async () => {
    const jobStartedAt = Date.now();
    console.log("[FeeStatus Cron] Starting daily fee status recompute job...");

    try {
        const schools = await findSchoolsWithTermStartingToday();

        if (schools.length === 0) {
            console.log("[FeeStatus Cron] No schools have a term starting today. Nothing to do.");
            return;
        }

        let totalMatched = 0;
        let totalUpdated = 0;

        for (const schoolDoc of schools) {
            // Identify which academicYear entry actually triggered the match for this school
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

                const matchingYearEntries = (schoolDoc.academicTermDates || []).filter((entry: any) => {
                    const dates = [entry.firstTerm, entry.secondTerm, entry.thirdTerm].filter(Boolean);
                    return dates.some((d: Date) => new Date(d) >= startOfDay && new Date(d) <= endOfDay);
                });

                for (const yearEntry of matchingYearEntries) {
                    const result = await recomputeForSchool(schoolDoc, String(yearEntry.academicYear));
                totalMatched += result.matched;
                totalUpdated += result.updated;
                console.log(
                    `[FeeStatus Cron] School ${result.schoolId} / Year ${yearEntry.academicYear} — ` +
                    `checked ${result.matched}, updated ${result.updated}`
                );
            }
        }

        console.log(
            `[FeeStatus Cron] Completed. Schools touched: ${schools.length}, ` +
            `records checked: ${totalMatched}, records updated: ${totalUpdated}, ` +
            `took ${Date.now() - jobStartedAt}ms`
        );
    } catch (error: any) {
        console.error("[FeeStatus Cron] Job failed:", error);
    }
};

/**
 * Schedules the job at 2:00 AM IST daily — well outside school hours
 * and outside typical evening fee-collection activity.
 */
export const scheduleFeeStatusRecomputeCron = () => {
    // "0 2 * * *" = 2:00 AM every day, server's local time
    cron.schedule("0 2 * * *", () => {
        runFeeStatusRecomputeJob();
    });

    console.log("[FeeStatus Cron] Scheduled to run daily at 2:00 AM.");
};



// TO MAKE THIS RUN 

// after DB connection is established

// scheduleFeeStatusRecomputeCron();
 
// like the below one

// connectDB().then(() => {
//     // app.listen(PORT, () => {
//     //     console.log(`Server running in the http://locahost:${PORT}`)
//     // })

//     server.listen(PORT, () => {
//         console.log(`🚀 HTTP & Socket Server running on http://localhost:${PORT}`);
//     });

//         scheduleFeeStatusRecomputeCron(); // 🌟 registers the 2 AM job — runs once at startup

// }).catch(err => console.log(err.message))
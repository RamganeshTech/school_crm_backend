
// ============================
// GET ALL EB LOGS (with filters)

import type { Response } from "express";
import { REDIS_KEYS } from "../../../constants/constant.js";
import redisClient from "../../../config/redisConfig.js";
import EBLogModel, { type IEBLog } from "../../../models/New_Model/eb_models/ebLog.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import { PremisesModel } from "../../../models/New_Model/eb_models/premises.model.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";




export const invalidateEBCache = async (schoolId: string): Promise<void> => {
    try {
        const pattern = `school:${schoolId}:eb*`;
        const stream = redisClient.scanStream({ match: pattern, count: 100 });

        const keysToDelete: string[] = [];
        for await (const keys of stream) {
            keysToDelete.push(...keys);
        }

        if (keysToDelete.length > 0) {
            await redisClient.del(...keysToDelete);
        }
    } catch (redisError) {
        console.error("Redis Invalidate Error (EB):", redisError);
    }
};


// ============================
export const getEBLogs = async (req: RoleBasedRequest, res: Response) => {

    try {
        const { schoolId } = req.params;
        const {
            premisesId,
            fromDate,
            toDate,
            minReading,
            maxReading,
            search, // matches ebLogNo
            // minAmount, maxAmount -> plug in once an amount field exists on the model
        } = req.query as Record<string, string | undefined>;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const hasFilters = premisesId || fromDate || toDate || minReading || maxReading || search;
        const cacheKey = REDIS_KEYS.schoolEBLogs(schoolId);

        // 1. ATTEMPT CACHE READ — only for the unfiltered base list
        if (!hasFilters) {
            try {
                const cachedData = await redisClient.get(cacheKey);
                if (cachedData) {
                    return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
                }
            } catch (redisError) {
                console.error("Redis Get Error (EBLogs):", redisError);
            }
        }

        const filter: Record<string, any> = { schoolId };

        if (premisesId) {
            filter.premisesId = premisesId;
        }

        if (fromDate || toDate) {
            filter.date = {};
            if (fromDate) filter.date.$gte = new Date(fromDate);
            if (toDate) filter.date.$lte = new Date(toDate);
        }

        if (minReading || maxReading) {
            filter.meterReading = {};
            if (minReading) filter.meterReading.$gte = Number(minReading);
            if (maxReading) filter.meterReading.$lte = Number(maxReading);
        }

        if (search) {
            filter.ebLogNo = { $regex: search, $options: "i" };
        }

        const logs = await EBLogModel.find(filter)
            .populate("premisesId", "premisesName")
            .sort({ date: 1, time: 1 })
            .lean();

        // 3. UPDATE CACHE — only for the unfiltered base list
        if (!hasFilters) {
            try {
                await redisClient.setex(cacheKey, 3600, JSON.stringify(logs));
            } catch (redisError) {
                console.error("Redis Set Error (EBLogs):", redisError);
            }
        }

        return res.status(200).json({ ok: true, data: logs });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// GET EB LOG BY ID
// ============================
export const getEBLogById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, logId } = req.params;

        if (!schoolId || !logId) {
            return res.status(400).json({ ok: false, message: "schoolId and logId are required" });
        }

        const cacheKey = REDIS_KEYS.schoolEBLogById(schoolId, logId);

        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
            }
        } catch (redisError) {
            console.error("Redis Get Error (EBLog by id):", redisError);
        }

        const log = await EBLogModel.findOne({ _id: logId, schoolId })
            .populate("premisesId", "premisesName")
            .lean();

        if (!log) {
            return res.status(404).json({ ok: false, message: "EB log not found" });
        }

        try {
            await redisClient.setex(cacheKey, 3600, JSON.stringify(log));
        } catch (redisError) {
            console.error("Redis Set Error (EBLog by id):", redisError);
        }

        return res.status(200).json({ ok: true, data: log });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// CREATE EB LOG
// ============================
export const createEBLog = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;
        const { premisesId, date, time, meterReading, note } = req.body;

        if (!schoolId || !premisesId || !date || !time || meterReading === undefined) {
            return res.status(400).json({ ok: false, message: "schoolId, premisesId, date, time and meterReading are required" });
        }

        if (typeof meterReading !== "number") {
            return res.status(400).json({ ok: false, message: "meterReading must be a number" });
        }

        // const premises = await PremisesModel.findOne({ _id: premisesId, schoolId });
        // if (!premises) {
        //     return res.status(404).json({ ok: false, message: "Premises not found for this school" });
        // }


        // find the previous log for this premises (latest one before this date/time)
        const previousLog = await EBLogModel.findOne({
            schoolId,
            premisesId,
            date: { $lte: date },
        })
            .sort({ date: -1, time: -1 })
            .lean();

        let kwUsed: number | null = null;
        if (previousLog) {
            const diff = meterReading - previousLog.meterReading;
            kwUsed = diff >= 0 ? diff : null; // guard against bad/reset readings
        }

        // ebLogNo is auto-generated in the pre-save hook
        const newLog = await EBLogModel.create({
            schoolId,
            premisesId,
            date,
            time,
            meterReading,
            note,
        });

        // INVALIDATE CACHE
        try {
            // await redisClient.del(REDIS_KEYS.schoolEBLogs(schoolId));
            await invalidateEBCache(schoolId);
        } catch (redisError) {
            console.error("Redis Del Error (Create EBLog):", redisError);
        }

        await createAuditLog(req, {
            action: "create",
            module: "ebLog",
            targetId: newLog?._id,
            description: `EB log created (${newLog.ebLogNo})`,
            status: "success"
        });

        return res.status(201).json({ ok: true, data: newLog });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, error: error?.message, message: "Internal server error" });
    }
};

// ============================
// UPDATE EB LOG
// ============================
export const updateEBLog = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, logId } = req.params;
        const { date, time, meterReading, note } = req.body;

        if (!schoolId || !logId) {
            return res.status(400).json({ ok: false, message: "schoolId and logId are required" });
        }

        const log = await EBLogModel.findOne({ _id: logId, schoolId });

        if (!log) {
            return res.status(404).json({ ok: false, message: "EB log not found" });
        }

        if (date !== undefined) log.date = date;
        if (time !== undefined) log.time = time;
        if (meterReading !== undefined) {
            if (typeof meterReading !== "number") {
                return res.status(400).json({ ok: false, message: "meterReading must be a number" });
            }
            log.meterReading = meterReading;
        }
        if (note !== undefined) log.note = note;

        // recompute kwUsed if date or meterReading changed
        if (date !== undefined || meterReading !== undefined) {
            const previousLog = await EBLogModel.findOne({
                schoolId,
                premisesId: log.premisesId,
                _id: { $ne: log._id },
                date: { $lte: log.date },
            })
                .sort({ date: -1, time: -1 })
                .lean();

            if (previousLog) {
                const diff = log.meterReading - previousLog.meterReading;
                log.kwUsed = diff >= 0 ? diff : null;
            } else {
                log.kwUsed = null;
            }
        }

        await log.save(); // isNew is false here, so ebLogNo is untouched

        // INVALIDATE CACHE
        try {
            // await redisClient.del(REDIS_KEYS.schoolEBLogs(schoolId));

            // await redisClient.del(REDIS_KEYS.schoolEBLogById(schoolId, logId));
            await invalidateEBCache(schoolId);
        } catch (redisError) {
            console.error("Redis Del Error (Update EBLog):", redisError);
        }

        await createAuditLog(req, {
            action: "update",
            module: "ebLog",
            targetId: log._id,
            description: `EB log updated (${log.ebLogNo})`,
            status: "success"
        });

        return res.status(200).json({ ok: true, data: log });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, error: error?.message, message: "Internal server error" });
    }
};

// ============================
// DELETE EB LOG (single)
// ============================
export const deleteEBLog = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, logId } = req.params;

        if (!schoolId || !logId) {
            return res.status(400).json({ ok: false, message: "schoolId and logId are required" });
        }

        const log = await EBLogModel.findOneAndDelete({ _id: logId, schoolId });

        if (!log) {
            return res.status(404).json({ ok: false, message: "EB log not found" });
        }

        // INVALIDATE CACHE
        try {
            // await redisClient.del(REDIS_KEYS.schoolEBLogs(schoolId));
            // await redisClient.del(REDIS_KEYS.schoolEBLogById(schoolId, logId));


            await invalidateEBCache(schoolId);
        } catch (redisError) {
            console.error("Redis Del Error (Delete EBLog):", redisError);
        }




        await archiveData({
            schoolId: log.schoolId,
            category: "ebLog",
            originalId: log._id,
            deletedData: log.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req.user!._id || null,
            reason: null, // Optional reason from body
        });


        await createAuditLog(req, {
            action: "delete",
            module: "ebLog",
            targetId: log._id,
            description: `EB log deleted (${log.ebLogNo})`,
            status: "success"
        });

        return res.status(200).json({ ok: true, message: "EB log deleted successfully" });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};



//  DASHBOARD CONTROLLER


export type LeanEBLog = Omit<IEBLog, keyof Document>;

// Gets the most recent log with date <= the given date, for a premises
export const getReadingAtOrBefore = async (
    schoolId: string,
    premisesId: string,
    date: Date
): Promise<IEBLog | null> => {
    return EBLogModel.findOne({
        schoolId,
        premisesId,
        date: { $lte: date },
    })
        .sort({ date: -1, time: -1 })
        .lean<LeanEBLog>();
};

// Consumption within [rangeStart, rangeEnd] = (reading on/before rangeEnd) - (reading before rangeStart)
export const computeConsumption = async (
    schoolId: string,
    premisesId: string,
    rangeStart: Date,
    rangeEnd: Date
): Promise<number | null> => {
    const endReading = await getReadingAtOrBefore(schoolId, premisesId, rangeEnd);
    const beforeStart = new Date(rangeStart.getTime() - 1);
    const startReading = await getReadingAtOrBefore(schoolId, premisesId, beforeStart);

    if (!endReading || !startReading) {
        return null; // not enough data to compute
    }

    const diff = endReading.meterReading - startReading.meterReading;
    return diff >= 0 ? diff : null; // guard against bad/reset readings
};

// Day-boundary helpers
export const getStartOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const getEndOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};




// ============================
// DASHBOARD OVERVIEW
// - total consumption yesterday (all premises)
// - recent 10 logs
// ============================
export const getEBDashboardOverview = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const todayStamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const cacheKey = REDIS_KEYS.schoolEBDashboard(schoolId, todayStamp!);

        // 1. ATTEMPT CACHE READ
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
            }
        } catch (redisError) {
            console.error("Redis Get Error (EB Dashboard):", redisError);
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const rangeStart = getStartOfDay(yesterday);
        const rangeEnd = getEndOfDay(yesterday);

        const premisesList = await PremisesModel.find({ schoolId, isActive: true }).lean();

        let totalConsumptionYesterday = 0;
        let premisesWithData = 0;

        for (const premises of premisesList) {
            const consumption = await computeConsumption(
                schoolId,
                premises._id.toString(),
                rangeStart,
                rangeEnd
            );
            if (consumption !== null) {
                totalConsumptionYesterday += consumption;
                premisesWithData += 1;
            }
        }

        const recentLogs = await EBLogModel.find({ schoolId })
            .populate("premisesId", "premisesName")
            .sort({ date: -1, time: -1, createdAt: -1 })
            .limit(10)
            .lean();

        const responseData = {
            totalConsumptionYesterday: Math.round(totalConsumptionYesterday * 100) / 100,
            premisesReportedYesterday: premisesWithData,
            totalPremises: premisesList.length,
            recentLogs,
        };

        // 3. UPDATE CACHE — short TTL since this is computed data
        try {
            await redisClient.setex(cacheKey, 600, JSON.stringify(responseData)); // 10 min
        } catch (redisError) {
            console.error("Redis Set Error (EB Dashboard):", redisError);
        }

        return res.status(200).json({ ok: true, data: responseData });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// PREMISES ANALYTICS
// - per premises: yesterday consumption, 30-day avg, projected this month
// ============================
export const getEBPremisesAnalytics = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const todayStamp = new Date().toISOString().split("T")[0];
        const cacheKey = REDIS_KEYS.schoolEBPremisesAnalytics(schoolId, todayStamp!);

        // 1. ATTEMPT CACHE READ
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
            }
        } catch (redisError) {
            console.error("Redis Get Error (EB Premises Analytics):", redisError);
        }

        const premisesList = await PremisesModel.find({ schoolId, isActive: true }).lean();

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayStart = getStartOfDay(yesterday);
        const yesterdayEnd = getEndOfDay(yesterday);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDayStart = getStartOfDay(thirtyDaysAgo);
        const thirtyDayEnd = getEndOfDay(today);

        const monthStart = getStartOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
        const monthEnd = getEndOfDay(today);
        const daysElapsedThisMonth = today.getDate(); // 1-indexed, e.g. 20 on the 20th
        const daysInThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        const analytics = [];

        for (const premises of premisesList) {
            const premisesIdStr = premises._id.toString();

            const yesterdayConsumption = await computeConsumption(
                schoolId,
                premisesIdStr,
                yesterdayStart,
                yesterdayEnd
            );

            const thirtyDayConsumption = await computeConsumption(
                schoolId,
                premisesIdStr,
                thirtyDayStart,
                thirtyDayEnd
            );
            const avg30DayConsumption =
                thirtyDayConsumption !== null ? thirtyDayConsumption / 30 : null;

            const monthToDateConsumption = await computeConsumption(
                schoolId,
                premisesIdStr,
                monthStart,
                monthEnd
            );
            let projectedThisMonth: number | null = null;
            if (monthToDateConsumption !== null && daysElapsedThisMonth > 0) {
                const avgDailyThisMonth = monthToDateConsumption / daysElapsedThisMonth;
                projectedThisMonth = avgDailyThisMonth * daysInThisMonth;
            }

            analytics.push({
                premisesId: premises._id,
                premisesName: premises.premisesName,
                yesterdayConsumption:
                    yesterdayConsumption !== null ? Math.round(yesterdayConsumption * 100) / 100 : null,
                avg30DayConsumption:
                    avg30DayConsumption !== null ? Math.round(avg30DayConsumption * 100) / 100 : null,
                projectedThisMonthConsumption:
                    projectedThisMonth !== null ? Math.round(projectedThisMonth * 100) / 100 : null,
            });
        }

        // 3. UPDATE CACHE
        try {
            await redisClient.setex(cacheKey, 600, JSON.stringify(analytics)); // 10 min
        } catch (redisError) {
            console.error("Redis Set Error (EB Premises Analytics):", redisError);
        }

        return res.status(200).json({ ok: true, data: analytics });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};



interface SeriesPoint {
    label: string;
    kwUsed: number | null;
}

// Computes bucketed consumption for ONE premises across the given buckets.
// Uses actual sorted meterReadings — immune to any backdated/out-of-order inserts.
export const computeSeriesForPremises = async (
    schoolId: string,
    premisesId: string,
    buckets: { bucketStart: Date; bucketEnd: Date; label: string }[]
): Promise<SeriesPoint[]> => {
    if (buckets.length === 0) return [];

    const firstBucket = buckets[0];
    const lastBucket = buckets[buckets.length - 1];

    if (!firstBucket || !lastBucket) return []; // guard, satisfies TS

    const rangeStart = firstBucket.bucketStart;
    const rangeEnd = lastBucket.bucketEnd;

    // const rangeStart = buckets[0].bucketStart;
    // const rangeEnd = buckets[buckets.length - 1].bucketEnd;

    // baseline reading just before the range starts
    const baseline = await getReadingAtOrBefore(
        schoolId,
        premisesId,
        new Date(rangeStart.getTime() - 1)
    );

    // all logs inside the range, sorted chronologically (NOT insertion order)
    const logsInRange = await EBLogModel.find({
        schoolId,
        premisesId,
        date: { $gte: rangeStart, $lte: rangeEnd },
    })
        .sort({ date: 1, time: 1 })
        .lean();

    let carryReading = baseline?.meterReading ?? null;
    let logCursor = 0;
    const points: SeriesPoint[] = [];

    for (const bucket of buckets) {
        // advance cursor through logs that fall inside this bucket, keep the LAST one
        let bucketEndReading: number | null = null;
        // while (
        //     logCursor < logsInRange.length &&
        //     logsInRange[logCursor].date <= bucket.bucketEnd
        // ) {
        while (logCursor < logsInRange.length) {

            // bucketEndReading = logsInRange[logCursor].meterReading;
            // logCursor++;

            const currentLog = logsInRange[logCursor];
            if (!currentLog || currentLog.date > bucket.bucketEnd) break;
            bucketEndReading = currentLog.meterReading;
            logCursor++;
        }

        if (bucketEndReading === null) {
            // no new reading this bucket — no consumption data for this slice
            points.push({ label: bucket.label, kwUsed: null });
            continue;
        }

        const kwUsed =
            carryReading !== null && bucketEndReading >= carryReading
                ? Math.round((bucketEndReading - carryReading) * 100) / 100
                : null;

        points.push({ label: bucket.label, kwUsed });
        carryReading = bucketEndReading;
    }

    return points;
};

export type ChartGranularity = "day" | "month";

interface Bucket {
    bucketStart: Date;
    bucketEnd: Date;
    label: string;
}

export const generateBuckets = (
    rangeStart: Date,
    rangeEnd: Date,
    granularity: ChartGranularity
): Bucket[] => {
    const buckets: Bucket[] = [];

    if (granularity === "day") {
        const cursor = new Date(rangeStart);
        cursor.setHours(0, 0, 0, 0);
        while (cursor <= rangeEnd) {
            const bucketStart = new Date(cursor);
            const bucketEnd = new Date(cursor);
            bucketEnd.setHours(23, 59, 59, 999);
            buckets.push({
                bucketStart,
                bucketEnd,
                // label: bucketStart.toISOString().split("T")[0], // "YYYY-MM-DD"
                label: bucketStart.toISOString().split("T")[0] ?? "", // fallback, split always returns at least 1 element in practice

            });
            cursor.setDate(cursor.getDate() + 1);
        }
    } else {
        // month
        const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
        while (cursor <= rangeEnd) {
            const bucketStart = new Date(cursor);
            const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
            buckets.push({
                bucketStart,
                bucketEnd,
                label: `${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, "0")}`, // "YYYY-MM"
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }
    }

    return buckets;
};

// for custom ranges: day buckets if range is short, month buckets if long
export const resolveGranularity = (rangeStart: Date, rangeEnd: Date): ChartGranularity => {
    const diffDays = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 62 ? "day" : "month"; // ~2 months threshold, tweak if needed
};

// ============================
// EB CONSUMPTION CHART
// period: today | week | month | year | custom
// premisesId: optional -> if omitted, returns series for ALL premises (for comparison)
// fromDate/toDate: required only when period=custom
// ============================
export const getEBConsumptionChart = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;
        const { period = "week", premisesId, fromDate, toDate } = req.query as Record<string, string | undefined>;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const validPeriods = ["today", "week", "month", "year", "custom"];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({ ok: false, message: `period must be one of: ${validPeriods.join(", ")}` });
        }

        if (period === "custom" && (!fromDate || !toDate)) {
            return res.status(400).json({ ok: false, message: "fromDate and toDate are required for custom period" });
        }

        // ---- resolve range + granularity (all calendar-based) ----
        const today = new Date();
        let rangeStart: Date;
        let rangeEnd: Date;
        let granularity: "day" | "month";

        switch (period) {
            case "today": {
                rangeStart = getStartOfDay(today);
                rangeEnd = getEndOfDay(today);
                granularity = "day";
                break;
            }
            case "week": {
                // this calendar week, Monday to Sunday
                const dayOfWeek = today.getDay(); // 0 = Sunday
                const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const monday = new Date(today);
                monday.setDate(today.getDate() - diffToMonday);
                rangeStart = getStartOfDay(monday);

                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                rangeEnd = getEndOfDay(sunday);

                granularity = "day";
                break;
            }
            case "month": {
                // this calendar month
                rangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
                rangeEnd = getEndOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
                granularity = "day";
                break;
            }
            case "year": {
                // this calendar year
                rangeStart = new Date(today.getFullYear(), 0, 1);
                rangeEnd = getEndOfDay(new Date(today.getFullYear(), 11, 31));
                granularity = "month";
                break;
            }
            case "custom":
            default: {
                rangeStart = getStartOfDay(new Date(fromDate as string));
                rangeEnd = getEndOfDay(new Date(toDate as string));
                granularity = resolveGranularity(rangeStart, rangeEnd);
                break;
            }
        }

        if (rangeStart > rangeEnd) {
            return res.status(400).json({ ok: false, message: "fromDate cannot be after toDate" });
        }

        const dateStamp = today.toISOString().split("T")[0] ?? "";
        const cacheKey = REDIS_KEYS.schoolEBChart(schoolId, period, premisesId || "all", dateStamp);

        // 1. ATTEMPT CACHE READ (skip cache for custom ranges)
        if (period !== "custom") {
            try {
                const cachedData = await redisClient.get(cacheKey);
                if (cachedData) {
                    return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
                }
            } catch (redisError) {
                console.error("Redis Get Error (EB Chart):", redisError);
            }
        }

        // ---- resolve premises to chart ----
        const premisesFilter: Record<string, any> = { schoolId, isActive: true };
        if (premisesId) premisesFilter._id = premisesId;

        const premisesList = await PremisesModel.find(premisesFilter).lean();

        if (premisesList.length === 0) {
            return res.status(404).json({ ok: false, message: "No premises found" });
        }

        const buckets = generateBuckets(rangeStart, rangeEnd, granularity);

        const chartData = [];
        for (const premises of premisesList) {
            const series = await computeSeriesForPremises(
                schoolId,
                premises._id.toString(),
                buckets
            );
            chartData.push({
                premisesId: premises._id,
                premisesName: premises.premisesName,
                series,
            });
        }

        const responseData = {
            period,
            granularity,
            rangeStart,
            rangeEnd,
            premises: chartData,
        };

        // 3. UPDATE CACHE
        if (period !== "custom") {
            try {
                await redisClient.setex(cacheKey, 600, JSON.stringify(responseData)); // 10 min
            } catch (redisError) {
                console.error("Redis Set Error (EB Chart):", redisError);
            }
        }

        return res.status(200).json({ ok: true, data: responseData });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};
import { type Response } from "express";
import type { RoleBasedRequest } from "../../../utils/types.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import { DailyTripLogModel } from "../../../models/New_Model/transport_model/dailyTrip.model.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import { resolveDateRange, type DateRangeType } from "./trasnportUtils.js";
import { Types } from "mongoose"
import { BusModel } from "../../../models/New_Model/transport_model/bus.model.js";
// import { RoleBasedRequest } from "../types/request.types"; // adjust path as needed
// import { DailyTripLogModel } from "../models/dailyTripLog.model";
// import { SchoolModel } from "../models/school.model"; // adjust path as needed
// import { createAuditLog } from "../utils/auditLog"; // adjust path as needed

// 1. CREATE
export const createDailyTripLog = async (req: RoleBasedRequest, res: Response) => {
    try {

        const { busId, date, openingOdometer, closingOdometer, notes, schoolId } = req.body;
        const enteredBy = req.user?._id;

        if (!busId) {
            return res.status(400).json({
                ok: false,
                message: "busId is required",
            });
        }
        if (!schoolId) {
            return res.status(400).json({
                ok: false,
                message: "schoolId is required",
            });
        }
        if (!date) {
            return res.status(400).json({
                ok: false,
                message: "date is required",
            });
        }
        if (openingOdometer === undefined || closingOdometer === undefined) {
            return res.status(400).json({
                ok: false,
                message: "openingOdometer and closingOdometer are required",
            });
        }

        const opening = parseFloat(openingOdometer);
        const closing = parseFloat(closingOdometer);

        if (isNaN(opening) || isNaN(closing)) {
            return res.status(400).json({
                ok: false,
                message: "Opening Odometer and Closing Odometer must be valid numbers",
            });
        }

        if (opening >= closing) {
            return res.status(400).json({
                ok: false,
                message: "Closing Odometer must be greater than Opening Odometer",
            });
        }

        const school = await SchoolModel.findById(schoolId).lean();
        if (!school) {
            return res.status(404).json({
                ok: false,
                message: "School not found",
            });
        }

        const kmRun = parseFloat((closing - opening).toFixed(2));
        // {Number((Number(formData.closingOdometer) - Number(formData.openingOdometer)).toFixed(2))} km

        const newLog = await DailyTripLogModel.create({
            schoolId,
            busId,
            date,
            enteredBy,
            openingOdometer: opening,
            closingOdometer: closing,
            kmRun,
            academicYear: school.currentAcademicYear,
            notes,
        });

        await createAuditLog(req, {
            action: "create",
            module: "dailyTripLog",
            targetId: newLog._id,
            description: `daily trip log created (${newLog._id})`,
            status: "success",
        });

        return res.status(201).json({
            ok: true,
            message: "Daily trip log created successfully",
            data: newLog,
        });
    } catch (error: any) {
        return res.status(500).json({
            ok: false,
            message: error?.message || "Failed to create daily trip log",
        });
    }
};

// 2. UPDATE
export const updateDailyTripLog = async (
    req: RoleBasedRequest,
    res: Response
) => {
    try {
        const { id } = req.params;
        const { busId, date, openingOdometer, closingOdometer, notes, schoolId } =
            req.body;

        const existingLog = await DailyTripLogModel.findOne({
            _id: id,
            schoolId,
        });

        if (!existingLog) {
            return res.status(404).json({
                ok: false,
                message: "Daily trip log not found",
            });
        }

        const opening =
            openingOdometer !== undefined
                ? parseFloat(openingOdometer)
                : existingLog.openingOdometer;
        const closing =
            closingOdometer !== undefined
                ? parseFloat(closingOdometer)
                : existingLog.closingOdometer;

        if (isNaN(opening) || isNaN(closing)) {
            return res.status(400).json({
                ok: false,
                message: "Opening Odometer and Closing Odometer must be valid numbers",
            });
        }

        if (opening >= closing) {
            return res.status(400).json({
                ok: false,
                message: "Closing Odometer must be greater than Opening Odometer",
            });
        }

        existingLog.busId = busId || existingLog.busId;
        existingLog.date = date || existingLog.date;
        existingLog.openingOdometer = opening;
        existingLog.closingOdometer = closing;
        existingLog.kmRun = parseFloat((closing - opening).toFixed(2));
        existingLog.notes = notes !== undefined ? notes : existingLog.notes;

        await existingLog.save();

        await createAuditLog(req, {
            action: "update",
            module: "dailyTripLog",
            targetId: existingLog._id,
            description: `daily trip log updated (${existingLog._id})`,
            status: "success",
        });

        return res.status(200).json({
            ok: true,
            message: "Daily trip log updated successfully",
            data: existingLog,
        });
    } catch (error: any) {
        return res.status(500).json({
            ok: false,
            message: error?.message || "Failed to update daily trip log",
        });
    }
};

// 3. GET ALL (paginated / infinite loading)
export const getAllDailyTripLogs = async (
    req: RoleBasedRequest,
    res: Response
) => {
    try {
        const {
            busId,
            academicYear,
            schoolId,
            search,
            fromDate,
            toDate,
            minKmRun,
            maxKmRun,
            minOpeningOdometer,
            maxOpeningOdometer,
            minClosingOdometer,
            maxClosingOdometer,
        } = req.query;

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        if (!schoolId) {
            return res.status(400).json({
                ok: false,
                message: "schoolId is required",
            });
        }

        const filter: Record<string, any> = { schoolId };
        if (busId) filter.busId = busId;
        if (academicYear) filter.academicYear = academicYear;

        // Date range
        if (fromDate || toDate) {
            filter.date = {};
            if (fromDate) filter.date.$gte = new Date(fromDate as string);
            if (toDate) filter.date.$lte = new Date(toDate as string);
        }

        // kmRun range
        if (minKmRun || maxKmRun) {
            filter.kmRun = {};
            if (minKmRun) filter.kmRun.$gte = Number(minKmRun);
            if (maxKmRun) filter.kmRun.$lte = Number(maxKmRun);
        }

        // opening odometer range
        if (minOpeningOdometer || maxOpeningOdometer) {
            filter.openingOdometer = {};
            if (minOpeningOdometer) filter.openingOdometer.$gte = Number(minOpeningOdometer);
            if (maxOpeningOdometer) filter.openingOdometer.$lte = Number(maxOpeningOdometer);
        }

        // closing odometer range
        if (minClosingOdometer || maxClosingOdometer) {
            filter.closingOdometer = {};
            if (minClosingOdometer) filter.closingOdometer.$gte = Number(minClosingOdometer);
            if (maxClosingOdometer) filter.closingOdometer.$lte = Number(maxClosingOdometer);
        }

        // search: dailyLogNo + notes
        if (search) {
            const searchRegex = new RegExp(String(search).trim(), "i");
            filter.$or = [
                { dailyLogNo: searchRegex },
                { notes: searchRegex },
                // { kmRun: searchRegex },
            ];
        }

        const [logs, total] = await Promise.all([
            DailyTripLogModel.find(filter)
                .populate("busId", "busNumber registrationNo")
                .populate("enteredBy", "userName _id")
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            DailyTripLogModel.countDocuments(filter),
        ]);

        const hasMore = skip + logs.length < total;

        return res.status(200).json({
            ok: true,
            message: "Daily trip logs fetched successfully",
            data: logs,
            pagination: {
                page,
                limit,
                total,
                hasMore,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            ok: false,
            message: error?.message || "Failed to fetch daily trip logs",
        });
    }
};

// 4. GET BY ID
export const getDailyTripLogById = async (
    req: RoleBasedRequest,
    res: Response
) => {
    try {
        const { id } = req.params;

        const log = await DailyTripLogModel.findOne({ _id: id })
            .populate("busId", "busNumber registrationNo")
            .populate("enteredBy", "name");

        if (!log) {
            return res.status(404).json({
                ok: false,
                message: "Daily trip log not found",
            });
        }

        return res.status(200).json({
            ok: true,
            message: "Daily trip log fetched successfully",
            data: log,
        });
    } catch (error: any) {
        return res.status(500).json({
            ok: false,
            message: error?.message || "Failed to fetch daily trip log",
        });
    }
};

// 5. DELETE
export const deleteDailyTripLog = async (
    req: RoleBasedRequest,
    res: Response
) => {
    try {
        const { id } = req.params;

        const log = await DailyTripLogModel.findOneAndDelete({
            _id: id,
        });

        if (!log) {
            return res.status(404).json({
                ok: false,
                message: "Daily trip log not found",
            });
        }

        // 2. CALL THE ARCHIVE UTILITY
        await archiveData({
            schoolId: log.schoolId,
            category: "dailyTripLog",
            originalId: log._id,
            deletedData: log.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req?.user?._id! || null,
            reason: null, // Optional reason from body
        });

        await createAuditLog(req, {
            action: "delete",
            module: "dailyTripLog",
            targetId: log._id,
            description: `daily trip log deleted (${log._id})`,
            status: "success",
        });

        return res.status(200).json({
            ok: true,
            message: "Daily trip log deleted successfully",
            data: log,
        });
    } catch (error: any) {
        return res.status(500).json({
            ok: false,
            message: error?.message || "Failed to delete daily trip log",
        });
    }
};







export const getDailyTripAnalytics = async (req: RoleBasedRequest, res: Response) => {
    try {
        const schoolId = req.params.schoolId

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const rangeType = (req.query.rangeType as DateRangeType) || "month";
        const customStart = req.query.startDate as string | undefined;
        const customEnd = req.query.endDate as string | undefined;

        let startDate: Date, endDate: Date;
        try {
            ({ startDate, endDate } = resolveDateRange(rangeType, customStart, customEnd));
        } catch (err: any) {
            return res.status(400).json({ ok: false, message: err.message });
        }

        const matchStage = {
            schoolId: new Types.ObjectId(schoolId),
            date: { $gte: startDate, $lte: endDate },
        };

        // ---- 1. Overall summary ----
        const [summary] = await DailyTripLogModel.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalKmRun: { $sum: "$kmRun" },
                    totalTrips: { $sum: 1 },
                    avgKmPerTrip: { $avg: "$kmRun" },
                    maxKmInADay: { $max: "$kmRun" },
                    minKmInADay: { $min: "$kmRun" },
                },
            },
        ]);

        // ---- 2. Bus-wise breakdown ----
        const busWiseBreakdown = await DailyTripLogModel.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$busId",
                    totalKmRun: { $sum: "$kmRun" },
                    totalTrips: { $sum: 1 },
                    avgKmPerTrip: { $avg: "$kmRun" },
                },
            },
            {
                $lookup: {
                    from: BusModel.collection.name,
                    localField: "_id",
                    foreignField: "_id",
                    as: "bus",
                },
            },
            { $unwind: { path: "$bus", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    busId: "$_id",
                    busNumber: "$bus.busNumber",
                    registrationNo: "$bus.registrationNo",
                    totalKmRun: 1,
                    totalTrips: 1,
                    avgKmPerTrip: { $round: ["$avgKmPerTrip", 2] },
                },
            },
            { $sort: { totalKmRun: -1 } },
        ]);

        // ---- 3. Daily trend (for chart) ----
        const dailyTrend = await DailyTripLogModel.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    totalKmRun: { $sum: "$kmRun" },
                    totalTrips: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", totalKmRun: 1, totalTrips: 1 } },
        ]);

        // ---- 4. Data integrity: odometer mismatch (closing - opening != kmRun) ----
       // ---- 4. Bus-wise Daily Trend (Multi-line chart) ----
        const busDailyTrend = await DailyTripLogModel.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                        busId: "$busId"
                    },
                    dailyKmRun: { $sum: "$kmRun" }
                }
            },
            {
                $lookup: {
                    from: BusModel.collection.name,
                    localField: "_id.busId",
                    foreignField: "_id",
                    as: "bus"
                }
            },
            { $unwind: { path: "$bus", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    date: "$_id.date",
                    busId: "$_id.busId",
                    busNumber: "$bus.busNumber",
                    registrationNo: "$bus.registrationNo",
                    dailyKmRun: 1
                }
            },
            { $sort: { date: 1 } }
        ]);


        // ---- 5. Buses with zero logs in range (idle/unused) ----
        const activeBusIds = await DailyTripLogModel.distinct("busId", matchStage);
        const idleBuses = await BusModel.find({
            schoolId: new Types.ObjectId(schoolId),
            _id: { $nin: activeBusIds },
        }).select("busNumber registrationNo");

        return res.status(200).json({
            ok: true,
            data: {
                range: { rangeType, startDate, endDate },
                summary: summary || {
                    totalKmRun: 0,
                    totalTrips: 0,
                    avgKmPerTrip: 0,
                    maxKmInADay: 0,
                    minKmInADay: 0,
                },
                busWiseBreakdown,
                dailyTrend,
                busDailyTrend, // <-- Added new data,
                idleBuses,
            },
        });
    } catch (error: any) {
        console.error("getDailyTripAnalytics error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};
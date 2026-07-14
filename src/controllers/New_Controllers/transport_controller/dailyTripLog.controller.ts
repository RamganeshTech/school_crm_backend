import { type Response } from "express";
import type { RoleBasedRequest } from "../../../utils/types.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import { DailyTripLogModel } from "../../../models/New_Model/transport_model/dailyTrip.model.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
// import { RoleBasedRequest } from "../types/request.types"; // adjust path as needed
// import { DailyTripLogModel } from "../models/dailyTripLog.model";
// import { SchoolModel } from "../models/school.model"; // adjust path as needed
// import { createAuditLog } from "../utils/auditLog"; // adjust path as needed

// 1. CREATE
export const createDailyTripLog = async (req: RoleBasedRequest, res: Response) => {
    try {

        const { busId, date, openingOdometer, closingOdometer, notes } =
            req.body;
        const schoolId = req.user?.schoolId;
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
                message: "openingOdometer and closingOdometer must be valid numbers",
            });
        }

        if (opening >= closing) {
            return res.status(400).json({
                ok: false,
                message: "closingOdometer must be greater than openingOdometer",
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
        const { busId, date, openingOdometer, closingOdometer, notes } =
            req.body;
        const schoolId = req.user?.schoolId;

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
                message: "openingOdometer and closingOdometer must be valid numbers",
            });
        }

        if (opening >= closing) {
            return res.status(400).json({
                ok: false,
                message: "closingOdometer must be greater than openingOdometer",
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
        const { busId, academicYear, schoolId } = req.query;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const filter: Record<string, any> = { schoolId };
        if (busId) filter.busId = busId;
        if (academicYear) filter.academicYear = academicYear;

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
            category: "annoucement",
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
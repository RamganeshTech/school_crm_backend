// import { AuditLogModel } from "../Models/Common/AuditLogModel.js";

import mongoose, { Types } from "mongoose";
import { AuditLogModel } from "../../../models/New_Model/audit_model/audit.model.js";
import type { Request, Response } from "express";
import type { RoleBasedRequest } from "../../../utils/types.js";

// Helper to get IP (Works for Direct Connection OR Proxy)
const getClientIp = (req: Request) => {
    return (String(req.headers['x-forwarded-lfor'] || '')).split(',')[0]
        || req.socket?.remoteAddress
        || req.ip
        || null;
};

export const createAuditLog = async (req: RoleBasedRequest, {
    action,
    module,
    targetId = null,
    description = "",
    status = "success"
}: {
    action: string,
    module: string,
    targetId: Types.ObjectId | null,
    description?: string,
    status: string

}) => {
    try {
        // 1. Extract User Info (Safely)
        const schoolId = req.user?.schoolId || req.body?.schoolId || req.query?.schoolId;
        const userId = req.user?._id || null;
        const userName = req.user?.userName || "System/Unknown";
        const role = req.user?.role || "Unknown";

        if (!schoolId) {
            // If we can't find a school ID, we skip logging (or log to a general system log)
            console.warn("[Audit] Skipped: No School ID found.");
            return;
        }

        // 2. Extract Technical Info
        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || "Unknown";

        // 3. Create Log
        const newLog = new AuditLogModel({
            schoolId,
            userId,
            userName,
            role,
            action,
            module,
            targetId,
            description,
            ipAddress,
            userAgent,
            status
        });

        // 4. Save (We don't await this to keep the API fast)
        await newLog.save()
        // .catch(err => console.error("Audit Save Error:", err));

    } catch (error: any) {
        console.error("Audit Helper Failed:", error);
    }
};


// / ussage  // LOG IT
// createAuditLog(req, {
//     action: "update",
//     module: "Announcement",
//     targetId: id,
//     description: `Deleted attachment from announcement`
// });



export const getAllAuditLogs = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            schoolId,
            module,
            action,
            role,
            userId,
            fromDate,
            toDate,
            page = 1,
            limit = 20
        } = req.query;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        // 1. Build Query
        const query:any = { schoolId: new mongoose.Types.ObjectId(schoolId) };

        if (module) query.module = module;
        if (action) query.action = action; // Case sensitive based on how you save it
        if (role) query.role = role;
        if (userId) query.userId = new mongoose.Types.ObjectId(userId);

        // Date Range Filter
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) {
                const endOfDay = new Date(toDate);
                endOfDay.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endOfDay;
            }
        }

        const pageNum = parseInt(page) || 1;

        const limitNum = parseInt(limit) || 10;

        const skip = (pageNum - 1) * limitNum;

        // 2. Fetch Logs
        const [logs, total] = await Promise.all([AuditLogModel.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limitNum),
        AuditLogModel.countDocuments(query)])

        // 3. Count Total
        // const total = await AuditLogModel.countDocuments(query);

        res.status(200).json({
            ok: true,
            message: "Audit logs fetched successfully",
            data: logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error: any) {
        console.error("Get Audit Logs Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

export const getAuditLogById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: "Invalid Log ID" });
        }

        const log = await AuditLogModel.findById(id).populate("userId", "userName _id");

        if (!log) {
            return res.status(404).json({ ok: false, message: "Log not found" });
        }

        res.status(200).json({
            ok: true,
            data: log
        });

    } catch (error: any) {
        console.error("Get Log By ID Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};
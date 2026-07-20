import { type Response } from "express";
import type { RoleBasedRequest } from "../../../utils/types.js";
import { REDIS_KEYS } from "../../../constants/constant.js";
import redisClient from "../../../config/redisConfig.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import { TariffModel } from "../../../models/New_Model/eb_models/tariff.model.js";
// ============================
// GET ALL TARIFFS
// ============================
export const getTariffs = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const cacheKey = REDIS_KEYS.schoolTariffs(schoolId);

        // 1. ATTEMPT CACHE READ
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
            }
        } catch (redisError) {
            console.error("Redis Get Error (Tariffs):", redisError);
        }

        const tariffs = await TariffModel.find({ schoolId }).sort({ createdAt: -1 }).lean();

        // 3. UPDATE CACHE
        try {
            await redisClient.setex(cacheKey, 3600, JSON.stringify(tariffs));
        } catch (redisError) {
            console.error("Redis Set Error (Tariffs):", redisError);
        }

        return res.status(200).json({ ok: true, data: tariffs });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// GET TARIFF BY ID
// ============================
export const getTariffById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, tariffId } = req.params;

        if (!schoolId || !tariffId) {
            return res.status(400).json({ ok: false, message: "schoolId and tariffId are required" });
        }

        const cacheKey = REDIS_KEYS.schoolTariffById(schoolId, tariffId);

        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
            }
        } catch (redisError) {
            console.error("Redis Get Error (Tariff by id):", redisError);
        }

        const tariff = await TariffModel.findOne({ _id: tariffId, schoolId }).lean();

        if (!tariff) {
            return res.status(404).json({ ok: false, message: "Tariff not found" });
        }

        try {
            await redisClient.setex(cacheKey, 3600, JSON.stringify(tariff));
        } catch (redisError) {
            console.error("Redis Set Error (Tariff by id):", redisError);
        }

        return res.status(200).json({ ok: true, data: tariff });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// ============================
// CREATE TARIFF
// ============================
export const createTariff = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;
        const { tariffName, fixedChargePerKw, slabs } = req.body;

        if (!schoolId || !tariffName || fixedChargePerKw === undefined) {
            return res.status(400).json({ ok: false, message: "schoolId, tariffName and fixedChargePerKw are required" });
        }

        if (typeof fixedChargePerKw !== "number") {
            return res.status(400).json({ ok: false, message: "fixedChargePerKw must be a number" });
        }

        if (slabs !== undefined && !Array.isArray(slabs)) {
            return res.status(400).json({ ok: false, message: "slabs must be an array" });
        }

        // Duplicate check (case-insensitive) within the same school
        const existing = await TariffModel.findOne({
            schoolId,
            tariffName: { $regex: new RegExp(`^${tariffName}$`, "i") }
        });

        if (existing) {
            return res.status(400).json({ ok: false, message: "Tariff name already exists for this school" });
        }

        const newTariff = await TariffModel.create({
            schoolId,
            tariffName,
            fixedChargePerKw,
            slabs: slabs || [],
        });

        // INVALIDATE CACHE
        try {
            await redisClient.del(REDIS_KEYS.schoolTariffs(schoolId));
        } catch (redisError) {
            console.error("Redis Del Error (Create Tariff):", redisError);
        }

        await createAuditLog(req, {
            action: "create",
            module: "tariff",
            targetId: newTariff?._id,
            description: `tariff created (${newTariff._id})`,
            status: "success"
        });

        return res.status(201).json({ ok: true, data: newTariff });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, error: error?.message, message: "Internal server error" });
    }
};

// ============================
// UPDATE TARIFF
// ============================
export const updateTariff = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, tariffId } = req.params;
        const { tariffName, fixedChargePerKw, slabs, isActive } = req.body;

        if (!schoolId || !tariffId) {
            return res.status(400).json({ ok: false, message: "schoolId and tariffId are required" });
        }

        const tariff = await TariffModel.findOne({ _id: tariffId, schoolId });

        if (!tariff) {
            return res.status(404).json({ ok: false, message: "Tariff not found" });
        }

        if (tariffName && tariffName !== tariff.tariffName) {
            const existing = await TariffModel.findOne({
                schoolId,
                _id: { $ne: tariffId },
                tariffName: { $regex: new RegExp(`^${tariffName}$`, "i") }
            });

            if (existing) {
                return res.status(400).json({ ok: false, message: "Tariff name already exists for this school" });
            }

            tariff.tariffName = tariffName;
        }

        if (fixedChargePerKw !== undefined) {
            if (typeof fixedChargePerKw !== "number") {
                return res.status(400).json({ ok: false, message: "fixedChargePerKw must be a number" });
            }
            tariff.fixedChargePerKw = fixedChargePerKw;
        }

        if (slabs !== undefined) {
            if (!Array.isArray(slabs)) {
                return res.status(400).json({ ok: false, message: "slabs must be an array" });
            }
            tariff.slabs = slabs;
        }

        if (typeof isActive === "boolean") {
            tariff.isActive = isActive;
        }

        await tariff.save();

        // INVALIDATE CACHE
        try {
            await redisClient.del(REDIS_KEYS.schoolTariffs(schoolId));
            await redisClient.del(REDIS_KEYS.schoolTariffById(schoolId, tariffId));
        } catch (redisError) {
            console.error("Redis Del Error (Update Tariff):", redisError);
        }

        await createAuditLog(req, {
            action: "update",
            module: "tariff",
            targetId: tariff._id,
            description: `tariff updated (${tariff._id})`,
            status: "success"
        });

        return res.status(200).json({ ok: true, data: tariff });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, error: error?.message, message: "Internal server error" });
    }
};

// ============================
// DELETE TARIFF (single)
// ============================
export const deleteTariff = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, tariffId } = req.params;

        if (!schoolId || !tariffId) {
            return res.status(400).json({ ok: false, message: "schoolId and tariffId are required" });
        }

        const tariff = await TariffModel.findOneAndDelete({ _id: tariffId, schoolId });

        if (!tariff) {
            return res.status(404).json({ ok: false, message: "Tariff not found" });
        }

        // INVALIDATE CACHE
        try {
            await redisClient.del(REDIS_KEYS.schoolTariffs(schoolId));
            await redisClient.del(REDIS_KEYS.schoolTariffById(schoolId, tariffId));
        } catch (redisError) {
            console.error("Redis Del Error (Delete Tariff):", redisError);
        }

        await createAuditLog(req, {
            action: "delete",
            module: "tariff",
            targetId: tariff._id,
            description: `tariff deleted (${tariff._id})`,
            status: "success"
        });


        await archiveData({
            schoolId: tariff.schoolId,
            category: "tariff",
            originalId: tariff._id,
            deletedData: tariff.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req.user!._id || null,
            reason: null, // Optional reason from body
        });


        return res.status(200).json({ ok: true, message: "Tariff deleted successfully" });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};
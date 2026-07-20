import { type Response } from "express";
import type { RoleBasedRequest } from "../../../utils/types.js";
import { REDIS_KEYS } from "../../../constants/constant.js";
import redisClient from "../../../config/redisConfig.js";
import { PremisesModel } from "../../../models/New_Model/eb_models/premises.model.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
// ============================
// GET ALL PREMISES
// ============================
export const getPremises = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const cacheKey = REDIS_KEYS.schoolPremises(schoolId);

        // 1. ATTEMPT CACHE READ
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
            }
        } catch (redisError) {
            console.error("Redis Get Error (Premises):", redisError);
            // fall back to MongoDB
        }

        // const premises = await PremisesModel.find({ schoolId }).sort({ createdAt: -1 }).lean();
        const premises = await PremisesModel.find({ schoolId })
            .populate("tariffId", "tariffName")
            .sort({ createdAt: -1 })
            .lean();

        // 3. UPDATE CACHE
        try {
            await redisClient.setex(cacheKey, 3600, JSON.stringify(premises));
        } catch (redisError) {
            console.error("Redis Set Error (Premises):", redisError);
        }

        return res.status(200).json({ ok: true, data: premises });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};



export const getPremisesById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, premisesId } = req.params;

        if (!schoolId || !premisesId) {
            return res.status(400).json({ ok: false, message: "schoolId and premisesId are required" });
        }

        const cacheKey = REDIS_KEYS.schoolPremisesById(schoolId, premisesId);

        // 1. ATTEMPT CACHE READ
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ ok: true, data: JSON.parse(cachedData), message: "retrived from cache" });
            }
        } catch (redisError) {
            console.error("Redis Get Error (Premises by id):", redisError);
        }

        const premises = await PremisesModel.findOne({ _id: premisesId, schoolId })
            .populate("tariffId", "tariffName")
            .lean();

        if (!premises) {
            return res.status(404).json({ ok: false, message: "Premises not found" });
        }

        // 3. UPDATE CACHE
        try {
            await redisClient.setex(cacheKey, 3600, JSON.stringify(premises));
        } catch (redisError) {
            console.error("Redis Set Error (Premises by id):", redisError);
        }

        return res.status(200).json({ ok: true, data: premises });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};


// ============================
// CREATE PREMISES
// ============================
export const createPremises = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params;
        // const { premisesName } = req.body;

        const {
            premisesName,
            premisesAddress,
            meterLocation,
            consumerNumber,
            tariffId,
            sanctionedLoad,
            billingCycleStartDate,
        } = req.body;


        if (!schoolId || !premisesName) {
            return res.status(400).json({ ok: false, message: "schoolId and premisesName are required" });
        }

        if (sanctionedLoad !== undefined && typeof sanctionedLoad !== "number") {
            return res.status(400).json({ ok: false, message: "sanctionedLoad must be a number" });
        }

        // Duplicate check (case-insensitive) within the same school
        const existing = await PremisesModel.findOne({
            schoolId,
            premisesName: { $regex: new RegExp(`^${premisesName}$`, "i") }
        });

        if (existing) {
            return res.status(400).json({ ok: false, message: "Premises name already exists for this school" });
        }

        const newPremises = await PremisesModel.create({
            schoolId,
            premisesName,
            premisesAddress,
            meterLocation,
            consumerNumber,
            tariffId: tariffId || undefined,
            sanctionedLoad,
            billingCycleStartDate,
        });

        // INVALIDATE CACHE
        try {
            await redisClient.del(REDIS_KEYS.schoolPremises(schoolId));
        } catch (redisError) {
            console.error("Redis Del Error (Create Premises):", redisError);
        }

        await createAuditLog(req, {
            action: "create",
            module: "premises",
            targetId: newPremises?._id,
            description: `premises created (${newPremises._id})`,
            status: "success"
        });

        return res.status(201).json({ ok: true, data: newPremises });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, error: error?.message, message: "Internal server error" });
    }
};

// ============================
// UPDATE PREMISES
// ============================
export const updatePremises = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, premisesId } = req.params;
        // const { premisesName, isActive } = req.body;

        const {
            premisesName,
            premisesAddress,
            meterLocation,
            consumerNumber,
            tariffId,
            sanctionedLoad,
            billingCycleStartDate,
            isActive,
        } = req.body;

        if (!schoolId || !premisesId) {
            return res.status(400).json({ ok: false, message: "schoolId and premisesId are required" });
        }

        const premises = await PremisesModel.findOne({ _id: premisesId, schoolId });

        if (!premises) {
            return res.status(404).json({ ok: false, message: "Premises not found" });
        }

        // Duplicate check if name is being changed
        if (premisesName && premisesName !== premises.premisesName) {
            const existing = await PremisesModel.findOne({
                schoolId,
                _id: { $ne: premisesId },
                premisesName: { $regex: new RegExp(`^${premisesName}$`, "i") }
            });

            if (existing) {
                return res.status(400).json({ ok: false, message: "Premises name already exists for this school" });
            }

            premises.premisesName = premisesName;
        }

        if (premisesAddress !== undefined) premises.premisesAddress = premisesAddress;
        if (meterLocation !== undefined) premises.meterLocation = meterLocation;
        if (consumerNumber !== undefined) premises.consumerNumber = consumerNumber;
        if (tariffId !== undefined) premises.tariffId = tariffId;
        if (billingCycleStartDate !== undefined) premises.billingCycleStartDate = billingCycleStartDate;

        if (sanctionedLoad !== undefined) {
            if (typeof sanctionedLoad !== "number") {
                return res.status(400).json({ ok: false, message: "sanctionedLoad must be a number" });
            }
            premises.sanctionedLoad = sanctionedLoad;
        }

        if (typeof isActive === "boolean") {
            premises.isActive = isActive;
        }

        await premises.save();


        // INVALIDATE CACHE
        try {
            await redisClient.del(REDIS_KEYS.schoolPremises(schoolId));
            await redisClient.del(REDIS_KEYS.schoolPremisesById(schoolId, premisesId));

        } catch (redisError) {
            console.error("Redis Del Error (Update Premises):", redisError);
        }

        await createAuditLog(req, {
            action: "update",
            module: "premises",
            targetId: premises._id,
            description: `premises updated (${premises._id})`,
            status: "success"
        });

        return res.status(200).json({ ok: true, data: premises });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, error: error?.message, message: "Internal server error" });
    }
};

// ============================
// DELETE PREMISES (single)
// ============================
export const deletePremises = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, premisesId } = req.params;

        if (!schoolId || !premisesId) {
            return res.status(400).json({ ok: false, message: "schoolId and premisesId are required" });
        }

        const premises = await PremisesModel.findOneAndDelete({ _id: premisesId, schoolId });

        if (!premises) {
            return res.status(404).json({ ok: false, message: "Premises not found" });
        }

        // INVALIDATE CACHE
        try {
            await redisClient.del(REDIS_KEYS.schoolPremises(schoolId));
            await redisClient.del(REDIS_KEYS.schoolPremisesById(schoolId, premisesId));

        } catch (redisError) {
            console.error("Redis Del Error (Delete Premises):", redisError);
        }

        await archiveData({
            schoolId: premises.schoolId,
            category: "premises",
            originalId: premises._id,
            deletedData: premises.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req.user!._id || null,
            reason: null, // Optional reason from body
        });

        await createAuditLog(req, {
            action: "delete",
            module: "premises",
            targetId: premises._id,
            description: `premises deleted (${premises._id})`,
            status: "success"
        });

        return res.status(200).json({ ok: true, message: "Premises deleted successfully" });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};
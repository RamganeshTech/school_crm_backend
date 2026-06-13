import { type Response } from 'express';
import FeeStructureConfigModel  from '../../../models/New_Model/FeeStructureModel/feestructureConfig.model.js';

// =========================================================
// 1. UPSERT (CREATE OR UPDATE) FEE CONFIGURATION
// =========================================================
export const upsertFeeConfig = async (req: any, res: Response) => {
    try {
        const schoolId = req.params?.schoolId;
        const { feeHeads, isActive } = req.body;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "School ID is required" });
        }

        // Perform Upsert strictly based on schoolId
        const updatedConfig = await FeeStructureConfigModel.findOneAndUpdate(
            { schoolId }, // Query to find existing config
            {
                $set: {
                    feeHeads: feeHeads || [],
                    isActive: isActive !== undefined ? isActive : true
                }
            }, // The data to update/insert
            { new: true, upsert: true, runValidators: true } // Upsert options
        );

        return res.status(200).json({
            ok: true,
            message: "Fee configuration saved successfully",
            data: updatedConfig
        });

    } catch (error: any) {
        console.error("Upsert Fee Config Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};

// =========================================================
// 2. GET CURRENT FEE CONFIGURATION
// =========================================================
export const getFeeConfig = async (req: any, res: Response) => {
    try {
        const {schoolId} = req.params;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "School ID is required" });
        }

        const feeConfig = await FeeStructureConfigModel.findOne({ schoolId });

        if (!feeConfig) {
            return res.status(404).json({ 
                ok: false, 
                message: "No fee configuration found for this school",
                data: null 
            });
        }

        return res.status(200).json({
            ok: true,
            message: "Fee configuration fetched successfully",
            data: feeConfig
        });

    } catch (error: any) {
        console.error("Get Fee Config Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
    }
};
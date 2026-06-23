import { type Response } from 'express';
import FeeStructureConfigModel from '../../../models/New_Model/FeeStructureModel/feeStructureConfig.model.js';

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
// 1. UPSERT (CREATE OR UPDATE) FEE CONFIGURATION (V1)
// =========================================================
export const upsertFeeConfigV1 = async (req: any, res: Response) => {
    try {
        const schoolId = req.params?.schoolId;
        const { feeHeads, isActive } = req.body;   

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "School ID is required" });
        }

        // --- 🌟 STRICT VALIDATION LOGIC ---
        let validatedFeeHeads = [];
        
        if (feeHeads && Array.isArray(feeHeads)) {
            const allowedTerms = ["firstTerm", "secondTerm", "thirdTerm"];
            const seenCombinations = new Set<string>();

            for (const item of feeHeads) {
                // 1. Check if feeHead name exists
                if (!item.feeHead || typeof item.feeHead !== 'string' || item.feeHead.trim() === '') {
                    return res.status(400).json({ 
                        ok: false, 
                        message: "A valid feeHead name is required for all entries." 
                    });
                }

                const cleanedFeeHead = item.feeHead.trim();
                let finalAssociatedTerm = null;

                // 2. Term Validation
                if (item.isTerm === true) {
                    if (!allowedTerms.includes(item.associatedTerm)) {
                        return res.status(400).json({
                            ok: false,
                            message: `Invalid term for '${cleanedFeeHead}'. If isTerm is true, associatedTerm must be one of: ${allowedTerms.join(", ")}`
                        });
                    }
                    finalAssociatedTerm = item.associatedTerm;
                } else {
                    // Force it to null if it's not a term-based fee, just to keep the DB clean
                    finalAssociatedTerm = null;
                }

                // 3. Duplicate Prevention (Blocks adding "Tuition Fee" + "firstTerm" twice)
                const combinationKey = `${cleanedFeeHead.toLowerCase()}_${finalAssociatedTerm || 'global'}`;
                if (seenCombinations.has(combinationKey)) {
                    return res.status(400).json({
                        ok: false,
                        message: `Duplicate entry detected: '${cleanedFeeHead}' is already assigned to ${finalAssociatedTerm || 'the global non-term list'}.`
                    });
                }
                seenCombinations.add(combinationKey);

                // Push sanitized data
                validatedFeeHeads.push({
                    feeHead: cleanedFeeHead,
                    associatedTerm: finalAssociatedTerm,
                    isTerm: item.isTerm === true
                });
            }
        }

        // Perform Upsert strictly based on schoolId with sanitized data
        const updatedConfig = await FeeStructureConfigModel.findOneAndUpdate(
            { schoolId }, 
            {
                $set: {
                    feeHeads: validatedFeeHeads,
                    isActive: isActive !== undefined ? isActive : true
                }
            }, 
            { new: true, upsert: true, runValidators: true } 
        );

        return res.status(200).json({
            ok: true,
            message: "Fee configuration saved successfully",
            data: updatedConfig
        });

    } catch (error: any) {
        console.error("Upsert Fee Config Error:", error);
        return res.status(500).json({ 
            ok: false, 
            message: "Internal server error", 
            error: error.message 
        });
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
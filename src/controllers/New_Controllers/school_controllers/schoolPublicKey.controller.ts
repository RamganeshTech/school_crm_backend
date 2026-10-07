// controllers/schoolPublicKey.controller.ts
import { type Response } from 'express';
import SchoolPublicKeyModel from '../../../models/New_Model/SchoolModel/schoolPublicKey.model.js';
import mongoose from 'mongoose';
import type { RoleBasedRequest } from '../../../utils/types.js';

// =========================================================
// 1. GET PUBLIC KEY FOR A SCHOOL (V1)
// =========================================================
export const getSchoolPublicKeyV1 = async (req: any, res: Response) => {
    try {
        const schoolId = req.params?.schoolId;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "School ID is required" });
        }

        const keyRecord = await SchoolPublicKeyModel.findOne({ schoolId, isActive: true });

        // if (!keyRecord) { 
        //     return res.status(404).json({
        //         ok: false,
        //         message: "No active public key registered for this school"
        //     });
        // }

        return res.status(200).json({
            ok: true,
            message: "Public key fetched successfully",
            data: keyRecord
        });

    } catch (error: any) {
        console.error("Get School Public Key Error:", error);
        return res.status(500).json({
            ok: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// =========================================================
// 2. UPSERT (REGISTER OR ROTATE) PUBLIC KEY (V1)
// =========================================================
export const upsertSchoolPublicKeyV1 = async (req: any, res: Response) => {
    try {
        const schoolId = req.params?.schoolId;
        const { publicKey } = req.body;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "School ID is required" });
        }

        // --- STRICT VALIDATION LOGIC ---
        if (!publicKey || typeof publicKey !== 'string' || publicKey.trim() === '') {
            return res.status(400).json({
                ok: false,
                message: "A valid publicKey is required."
            });
        }

        const cleanedPublicKey = publicKey.trim();

        // If a key is already registered for this school, deactivate it rather
        // than overwrite — keeps a retired key auditable/rejectable instead of
        // silently lost, matching the offline app's key-rotation intent.
        // const existing = await SchoolPublicKeyModel.findOne({ schoolId });
        // if (existing && existing.publicKey !== cleanedPublicKey) {
        //     existing.isActive = false;
        //     await existing.save();
        // }

        // const updatedKey = await SchoolPublicKeyModel.findOneAndUpdate(
        //     { schoolId, publicKey: cleanedPublicKey },
        //     {
        //         $set: {
        //             schoolId,
        //             publicKey: cleanedPublicKey,
        //             isActive: true,
        //             registeredAt: new Date()
        //         }
        //     },
        //     { new: true, upsert: true, runValidators: true }
        // );


        // Find strictly by schoolId and overwrite the existing document to respect the unique index.
        const updatedKey = await SchoolPublicKeyModel.findOneAndUpdate(
            { schoolId }, 
            {
                $set: {
                    publicKey: cleanedPublicKey,
                    isActive: true,
                    registeredAt: new Date()
                }
            },
            { new: true, upsert: true, runValidators: true }
        );

        return res.status(200).json({
            ok: true,
            message: "Public key registered successfully",
            data: updatedKey
        });

    } catch (error: any) {
        console.error("Upsert School Public Key Error:", error);
        return res.status(500).json({
            ok: false,
            message: "Internal server error",
            error: error.message
        });
    }
};




// controllers/SchoolPublicKeyController/schoolDesktopTracking.controller.ts

export const getSchoolDesktopActivationStatus = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.params

        if (!mongoose.Types.ObjectId.isValid(schoolId)) {
            return res.status(400).json({
                ok: false,
                message: 'Invalid school id'
            })
        }

        const record = await SchoolPublicKeyModel.findOne({ schoolId })
            .select('registeredAt isActive createdAt updatedAt')
            .lean()

        if (!record) {
            return res.status(200).json({
                ok: true,
                message: 'Desktop app has not been activated for this school',
                data: {
                    schoolId,
                    isActivated: false,
                    isActive: false,
                    activatedAt: null,
                    lastUpdatedAt: null
                }
            })
        }

        return res.status(200).json({
            ok: true,
            message: 'Desktop activation status fetched successfully',
            data: {
                schoolId,
                isActivated: true,
                isActive: record.isActive,
                activatedAt: record.registeredAt,
                lastUpdatedAt: record.updatedAt
            }
        })
    } catch (error: any) {
        console.error('getSchoolDesktopActivationStatus error:', error)
        return res.status(500).json({
            ok: false,
            message: error.message || 'Failed to fetch desktop activation status'
        })
    }
}
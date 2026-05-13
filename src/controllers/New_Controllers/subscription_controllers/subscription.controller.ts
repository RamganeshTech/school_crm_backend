
import type { Response } from "express";
import SchoolModel from "../../../models/New_Model/SchoolModel/shoolModel.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";

// PRE-DEFINED PACKAGES (Optional helper)
const PACKAGES:any = {
    basic: {
        studentRecord: true,
        attendance: false,
        expense: false,
        club: false,
        announcement: false
    },
    standard: {
        studentRecord: true,
        attendance: true,
        expense: true,
        club: false,
        announcement: false
    },
    premium: {
        studentRecord: true,
        attendance: true,
        expense: true,
        club: true,
        announcement: true
    }
};

export const updateSchoolSubscription = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, planName, customModules } = req.body;

        const isPlatformAdmin = req?.user?.isPlatformAdmin || false

        if (!isPlatformAdmin) {
            return res.status(403).json({ message: "sorry you cannot make updation in the subscripition, only platform admin is allowed to update", ok: false })
        }

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "School ID required" });
        }

        let modulesToSet = {};

        // 1. If a Standard Plan is selected, load defaults
        if (planName && PACKAGES[planName]) {
            modulesToSet = { ...PACKAGES[planName] };
        }

        // 2. If 'customModules' are passed, they override the plan defaults
        // Example: Plan is "Basic" but they paid extra for "Attendance"
        if (customModules) {
            modulesToSet = { ...modulesToSet, ...customModules };
        }

        // 3. Update Database
        const updatedSchool = await SchoolModel.findByIdAndUpdate(
            schoolId,
            {
                $set: {
                    "subscription.planName": planName || "custom",
                    "subscription.modules": modulesToSet
                }
            },
            { new: true } // Return updated doc
        ).select("name subscription");

        return res.status(200).json({
            ok: true,
            message: "School subscription updated successfully",
            data: updatedSchool
        });

    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// Controller for the School to check what features they have
export const getMyFeatures = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId } = req.query; // or req.user.schoolId


        // console.log("req.role", req.user);

        const school = await SchoolModel.findById(schoolId).select("subscription.modules subscription.planName");

        if (!school) return res.status(404).json({ ok: false, message: "School not found" });

        return res.status(200).json({
            ok: true,
            plan: school.subscription.planName,
            features: school.subscription.modules
        });

    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
}
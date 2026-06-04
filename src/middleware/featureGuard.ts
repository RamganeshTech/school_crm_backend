// import { SchoolModel } from "../models/school.model.js";

import type { NextFunction, Response } from "express";
import SchoolModel from "../models/New_Model/SchoolModel/shoolModel.model.js";
import type { RoleBasedRequest } from "../utils/types.js";

type featureType = "attendance" | "studentRecord" | "expense" | "club" | "announcement" | "markReport"
// This function takes the module name you want to protect (e.g., 'attendance')
export const featureGuard = (moduleName: featureType) => {
    // return async (req, res, next) => {
    return async (req: RoleBasedRequest, res: Response, next: NextFunction) => {
        try {
            // 1. Get School ID (Assuming it's in req.user from auth middleware, or req.query)
            // Adjust this based on how you pass schoolId (headers, query, or token)
            const schoolId = req.user?.schoolId || req.query.schoolId;

            if (!schoolId) {
                return res.status(400).json({ ok: false, message: "School ID missing" });
            }

            // 2. Fetch School Subscription
            const school = await SchoolModel.findById(schoolId).select("subscription isActive");

            if (!school || !school.isActive) {
                return res.status(403).json({ ok: false, message: "School is inactive or not found" });
            }

            // 3. Check specific module permission
            // We check if the module exists in the list AND is set to true
            const modules = school.subscription?.modules as Record<string, boolean>;
            const hasAccess = modules?.[moduleName];

            if (!hasAccess) {
                return res.status(403).json({
                    ok: false,
                    message: `Upgrade Required: Your plan does not include the '${moduleName}' module.`
                });
            }

            // 4. Access Granted
            next();

        } catch (error: any) {
            console.error("Feature Guard Error:", error);
            res.status(500).json({ ok: false, message: "Internal Server Error" });
        }
    };
};
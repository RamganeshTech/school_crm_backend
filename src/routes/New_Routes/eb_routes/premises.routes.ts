import { Router } from "express";
import { createPremises, deletePremises, getPremises, updatePremises } from "../../../controllers/New_Controllers/eb_controllers/premises.controller.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
// Adjust the import paths according to your actual folder structure


const premisesRoutes = Router();

// Reusable roles array excluding "teacher"
const allowedRoles = ["correspondent", "administrator", "principal"];

// ============================
// GET ALL PREMISES
// ============================
premisesRoutes.get(
    "/get/:schoolId",
    multiRoleAuth("accountant", "correspondent", "administrator", "principal", "viceprincipal", "teacher", ),
    getPremises
);

// ============================
// CREATE PREMISES
// ============================
premisesRoutes.post(
    "/create/:schoolId",
    multiRoleAuth("correspondent", "administrator", "principal"),
    createPremises
);

// ============================
// UPDATE PREMISES
// ============================
premisesRoutes.put(
    "/update/:schoolId/:premisesId",
    multiRoleAuth("correspondent", "administrator", "principal"),
    updatePremises
);

// ============================
// DELETE PREMISES
// ============================
premisesRoutes.delete(
    "/delete/:schoolId/:premisesId",
    multiRoleAuth("correspondent", "administrator", "principal"),
    deletePremises
);

export default premisesRoutes;
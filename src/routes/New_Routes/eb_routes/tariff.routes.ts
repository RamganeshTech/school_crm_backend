import { Router } from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import {  getTariffs,
 getTariffById,
 createTariff,
 updateTariff,
 deleteTariff } from "../../../controllers/New_Controllers/eb_controllers/tariff.controller.js";

const tariffRoutes = Router();

// ============================
// GET ALL TARIFFS
// ============================
tariffRoutes.get(
    "/get-all/:schoolId",
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant"),
    getTariffs
);

// ============================
// GET TARIFF BY ID
// ============================
tariffRoutes.get(
    "/get/:schoolId/:tariffId",
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant"),
    getTariffById
);

// ============================
// CREATE TARIFF
// ============================
tariffRoutes.post(
    "/create/:schoolId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    createTariff
);

// ============================
// UPDATE TARIFF
// ============================
tariffRoutes.put(
    "/update/:schoolId/:tariffId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    updateTariff
);

// ============================
// DELETE TARIFF
// ============================
tariffRoutes.delete(
    "/delete/:schoolId/:tariffId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    deleteTariff
);

export default tariffRoutes;
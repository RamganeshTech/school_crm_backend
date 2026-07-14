import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { createDailyTripLog, deleteDailyTripLog, getAllDailyTripLogs, getDailyTripLogById, updateDailyTripLog } from "../../../controllers/New_Controllers/transport_controller/dailyTripLog.controllers.js";

// upload.any() so every file (statutoryDocuments_0, statutoryDocuments_1, ...) lands in req.files as a flat array

const dailyTripLogRoutes = express.Router();

dailyTripLogRoutes.post(
    "/create",
    multiRoleAuth("administrator", "correspondent"),
    createDailyTripLog
);

dailyTripLogRoutes.get("/", multiRoleAuth("administrator", "correspondent"), getAllDailyTripLogs);


dailyTripLogRoutes.get("/:id", multiRoleAuth("administrator", "correspondent"), getDailyTripLogById);

dailyTripLogRoutes.put(
    "/:id",
    multiRoleAuth("administrator", "correspondent"),
    updateDailyTripLog
);

dailyTripLogRoutes.delete("/:id", multiRoleAuth("administrator", "correspondent"), deleteDailyTripLog);


export default dailyTripLogRoutes;
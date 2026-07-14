import express from "express";
import { upload } from "../../../utils/s4UploadsNew.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { createDailyTripLog, deleteDailyTripLog, getAllDailyTripLogs, getDailyTripLogById, updateDailyTripLog } from "../../../controllers/New_Controllers/transport_controller/dailyTripLog.controllers.js";

// upload.any() so every file (statutoryDocuments_0, statutoryDocuments_1, ...) lands in req.files as a flat array

const fuelLogRoutes = express.Router();

fuelLogRoutes.post(
    "/create",
    multiRoleAuth("administrator", "correspondent"),
    createDailyTripLog
);

fuelLogRoutes.get("/", multiRoleAuth("administrator", "correspondent"), getAllDailyTripLogs);


fuelLogRoutes.get("/:id", multiRoleAuth("administrator", "correspondent"), getDailyTripLogById);

fuelLogRoutes.put(
    "/:id",
    multiRoleAuth("administrator", "correspondent"),
    updateDailyTripLog
);

fuelLogRoutes.delete("/:id", multiRoleAuth("administrator", "correspondent"), deleteDailyTripLog);


export default fuelLogRoutes;
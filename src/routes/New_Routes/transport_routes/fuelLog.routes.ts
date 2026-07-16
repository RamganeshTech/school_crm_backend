import express from "express";
import { upload } from "../../../utils/s4UploadsNew.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { createFuelLog, deleteFuelLog,getAllFuelLogs,getFuelLogAnalytics,getFuelLogById,updateFuelLog } from "../../../controllers/New_Controllers/transport_controller/fuelLog.controller.js";
// import { createDailyTripLog, deleteDailyTripLog, getAllDailyTripLogs, getDailyTripLogById, updateDailyTripLog } from "../../../controllers/New_Controllers/transport_controller/dailyTripLog.controllers.js";

// upload.any() so every file (statutoryDocuments_0, statutoryDocuments_1, ...) lands in req.files as a flat array

const fuelLogRoutes = express.Router();

fuelLogRoutes.post(
    "/create",
    multiRoleAuth("administrator", "correspondent"),
    createFuelLog
);

fuelLogRoutes.get("/", multiRoleAuth("administrator", "correspondent"), getAllFuelLogs);


fuelLogRoutes.get("/:id", multiRoleAuth("administrator", "correspondent"), getFuelLogById);

fuelLogRoutes.put(
    "/:id",
    multiRoleAuth("administrator", "correspondent"),
    updateFuelLog
);

fuelLogRoutes.delete("/:id", multiRoleAuth("administrator", "correspondent"), deleteFuelLog);
fuelLogRoutes.get("/analytics/:schoolId", multiRoleAuth("administrator", "correspondent"), getFuelLogAnalytics);


export default fuelLogRoutes;
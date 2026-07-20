import { Router } from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getEBLogs,
getEBLogById,
createEBLog,
updateEBLog,
deleteEBLog, 
getEBPremisesAnalytics,
getEBDashboardOverview,
getEBConsumptionChart} from "../../../controllers/New_Controllers/eb_controllers/ebLog.controller.js";


const ebLogsRoutes = Router();

// ============================
// GET ALL EB LOGS (with query filters)
// ============================
ebLogsRoutes.get(
    "/get-all/:schoolId",
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant"),
    getEBLogs
);

// ============================
// GET EB LOG BY ID
// ============================
ebLogsRoutes.get(
    "/get/:schoolId/:logId",
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant"),
    getEBLogById
);

// ============================
// CREATE EB LOG
// ============================
ebLogsRoutes.post(
    "/create/:schoolId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    createEBLog
);

// ============================
// UPDATE EB LOG
// ============================
ebLogsRoutes.put(
    "/update/:schoolId/:logId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    updateEBLog
);

// ============================
// DELETE EB LOG
// ============================
ebLogsRoutes.delete(
    "/delete/:schoolId/:logId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    deleteEBLog
);



ebLogsRoutes.get(
    "/analytics/premises/:schoolId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    getEBPremisesAnalytics
);




ebLogsRoutes.get(
    "/analytics/dashboard/:schoolId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    getEBDashboardOverview
);



ebLogsRoutes.get(
    "/analytics/line-chart/consumption/:schoolId",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    getEBConsumptionChart
);








export default ebLogsRoutes;
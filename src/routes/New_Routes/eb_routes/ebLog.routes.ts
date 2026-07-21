import { Router } from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getEBLogs,
getEBLogById,
createEBLog,
updateEBLog,
deleteEBLog, 
getEBPremisesAnalytics,
getEBDashboardOverview,
getEBConsumptionChart,
getEBDashboardBillKpis} from "../../../controllers/New_Controllers/eb_controllers/ebLog.controller.js";


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

// anlaytics routes starts from here 

ebLogsRoutes.get(
    "/analytics/:schoolId/premises",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    getEBPremisesAnalytics
);




ebLogsRoutes.get(
    "/analytics/:schoolId/dashboard",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    getEBDashboardOverview
);



ebLogsRoutes.get(
    "/analytics/:schoolId/line-chart/consumption",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    getEBConsumptionChart
);

ebLogsRoutes.get(
    "/analytics/:schoolId/bill/kpi",
    multiRoleAuth("correspondent", "administrator", "principal", "accountant"),
    getEBDashboardBillKpis
);







export default ebLogsRoutes;
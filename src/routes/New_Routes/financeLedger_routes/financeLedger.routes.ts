import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getAllTransactions, getAllTransactionsV1, getCollectedFeesStats, getFeeDuesStudentWise, getFinanceStats, getFinanceTimeline, getFinanceTimelinev1, getOutstandingStats, getRecentFeeActivity, getTransactionById, getTransactionByIdV1 } from "../../../controllers/New_Controllers/financeLedger_controller/financeLedger.controller.js";
// import { getAllTransactions, getFinanceStats, getFinanceTimeline, getOutstandingStats, getTransactionById } from "../../../Controllers/New_Controllers/financeLedger_controller/financeLedger.controller.js";

const financeRoutes = express.Router();

// Get All (Filterable)
financeRoutes.get("/getall", multiRoleAuth("correspondent", "accountant", "principal" , "viceprincipal"), getAllTransactions);
financeRoutes.get("/v1/getall", multiRoleAuth("correspondent", "accountant", "principal" , "viceprincipal"), getAllTransactionsV1);

// Get Single ID
financeRoutes.get("/get/:id", multiRoleAuth("correspondent", "accountant", "principal", "viceprincipal"), getTransactionById);
financeRoutes.get("/v1/get/:id", multiRoleAuth("correspondent", "accountant", "principal", "viceprincipal"), getTransactionByIdV1);

// ==========================================
// NEW DASHBOARD VISUALIZATION ROUTES
// ==========================================

financeRoutes.get("/stats", multiRoleAuth("correspondent", "administrator", "accountant", "principal", "viceprincipal"), getFinanceStats);

financeRoutes.get("/timeline", multiRoleAuth("correspondent", "administrator", "accountant", "principal", "viceprincipal"), getFinanceTimeline);
financeRoutes.get("/v1/timeline", multiRoleAuth("correspondent", "administrator", "accountant", "principal", "viceprincipal"), getFinanceTimelinev1);

financeRoutes.get("/outstanding", multiRoleAuth("correspondent", "administrator", "accountant", "principal", "viceprincipal"), getOutstandingStats);

financeRoutes.get("/v1/collected", multiRoleAuth("correspondent", "administrator", "accountant", "principal", "viceprincipal"), getCollectedFeesStats);
financeRoutes.get("/v1/student/recent-activity", multiRoleAuth("correspondent", "administrator", "accountant", "principal", "viceprincipal"), getRecentFeeActivity);

financeRoutes.get("/v1/class/fee-dues", multiRoleAuth("correspondent", "administrator", "accountant", "principal", "viceprincipal"), getFeeDuesStudentWise);



export default financeRoutes;
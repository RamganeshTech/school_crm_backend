import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getAllTransactions, getFinanceStats, getFinanceTimeline, getOutstandingStats, getTransactionById } from "../../../controllers/New_Controllers/financeLedger_controller/financeLedger.controller.js";
// import { getAllTransactions, getFinanceStats, getFinanceTimeline, getOutstandingStats, getTransactionById } from "../../../Controllers/New_Controllers/financeLedger_controller/financeLedger.controller.js";

const financeRoutes = express.Router();

// Get All (Filterable)
financeRoutes.get("/getall", multiRoleAuth("correspondent", "accountant", "principal"), getAllTransactions);

// Get Single ID
financeRoutes.get("/get/:id", multiRoleAuth("correspondent", "accountant", "principal"), getTransactionById);

// ==========================================
// NEW DASHBOARD VISUALIZATION ROUTES
// ==========================================

financeRoutes.get("/stats", multiRoleAuth("correspondent", "accountant", "principal"), getFinanceStats);

financeRoutes.get("/timeline", multiRoleAuth("correspondent", "accountant", "principal"), getFinanceTimeline);

financeRoutes.get("/outstanding", multiRoleAuth("correspondent", "accountant", "principal"), getOutstandingStats);

export default financeRoutes;
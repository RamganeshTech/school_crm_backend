import express from "express";
// import { getAllAuditLogs, getAuditLogById } from "../../../controllers/New_Controllers/audit_controllers/audit.controllers.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getAllAuditLogs, getAuditLogById } from "../../../controllers/New_Controllers/audit_controllers/audit.controllers.js";
// import { getAllAuditLogs, getAuditLogById } from "../../../Controllers/New_Controllers/audit_controllers/audit.controllers.js";

const auditRoutes = express.Router();

// ==============================================================================
// 1. SHEET OPERATIONS (Class Level)
// ==============================================================================

// GET: Fetch the Daily Sheet (Create Mode or Edit Mode)
// Used by Teachers daily
auditRoutes.get(
  "/getall",
  multiRoleAuth("administrator", "correspondent", "principal", "viceprincipal"),
  getAllAuditLogs
);



auditRoutes.get(
  "/get/:id",
  multiRoleAuth("administrator", "correspondent", "principal", "viceprincipal"),
  getAuditLogById
);

export default auditRoutes;
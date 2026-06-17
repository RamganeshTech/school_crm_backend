import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getFeeConfig, upsertFeeConfig } from "../../../controllers/New_Controllers/feeStructure_controller/feeStructureConfig.controller.js";
// import { setFeeStructure, getFeeStructureByClass } from "../controllers/feeStructureController.js";
// import { multiRoleAuth } from "../middlewares/authMiddleware.js";

const feeStructureConfigRoutes = express.Router()


feeStructureConfigRoutes.post(
  "/set/:schoolId",
  multiRoleAuth("correspondent", "administrator", "accountant"),
  upsertFeeConfig
);

// Endpoint: Get Fee Structure (Used for editing or during Admission)
// Access: Accountant also needs this to see fees
feeStructureConfigRoutes.get(
  "/get/:schoolId",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  getFeeConfig
);


export default feeStructureConfigRoutes;
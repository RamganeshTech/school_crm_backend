import express from "express";
import { deleteFeeStructure, deleteFeeStructureV1, getFeeStructure, getFeeStructureByClass, getFeeStructureByClassV1, getFeeStructureV1, setFeeStructure, setFeeStructureV1 } from "../../../controllers/New_Controllers/feeStructure_controller/feeStructure.controller.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
// import { setFeeStructure, getFeeStructureByClass } from "../controllers/feeStructureController.js";
// import { multiRoleAuth } from "../middlewares/authMiddleware.js";

const feeStructureRoutes = express.Router();

// ====================================================================
// FEE STRUCTURE ROUTES
// ====================================================================

// Endpoint: Set or Update Fee Structure for a Class
// Access: PlatformAdmin, Correspondent, Principal
feeStructureRoutes.post(
  "/set",
  multiRoleAuth("correspondent", "administrator", "accountant"),
  setFeeStructure
);

// Endpoint: Get Fee Structure (Used for editing or during Admission)
// Access: Accountant also needs this to see fees
feeStructureRoutes.get(
  "/getbyclass",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  getFeeStructureByClass
);


feeStructureRoutes.delete(
  "/delete/:id",
  multiRoleAuth("correspondent", "administrator"),
  deleteFeeStructure
);


feeStructureRoutes.get(
  "/getall",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  getFeeStructure
);



//  NEW VERSION


// Endpoint: Set or Update Fee Structure for a Class
// Access: PlatformAdmin, Correspondent, Principal
feeStructureRoutes.post(
  "/v1/set",
  multiRoleAuth("correspondent", "administrator", "accountant"),
  setFeeStructureV1
);

// Endpoint: Get Fee Structure (Used for editing or during Admission)
// Access: Accountant also needs this to see fees
feeStructureRoutes.get(
  "/v1/getbyclass",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  getFeeStructureByClassV1
);


feeStructureRoutes.delete(
  "/v1/delete/:id",
  multiRoleAuth("correspondent", "administrator"),
  deleteFeeStructureV1
);


feeStructureRoutes.get(
  "/v1/getall",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  getFeeStructureV1
);


export default feeStructureRoutes;
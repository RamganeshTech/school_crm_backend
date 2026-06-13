import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getAllFeeTransactions, getFeeTransactionById, updateChequeStatus } from "../../../controllers/New_Controllers/feeReceipt_controllers/feeReceipt.controllers.js";

const feeReceiptRoutes = express.Router();

// Endpoint: Set or Update Fee Structure for a Class
// Access: PlatformAdmin, Correspondent, Principal
feeReceiptRoutes.get(
  "/getall",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "parent"),
  getAllFeeTransactions
);

// Endpoint: Get Fee Structure (Used for editing or during Admission)
// Access: Accountant also needs this to see fees
feeReceiptRoutes.get(
  "/get/:id",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "parent"),
  getFeeTransactionById
);


feeReceiptRoutes.patch(
  "/v1/update-status/:id",
  multiRoleAuth("correspondent", "administrator", "accountant",),
  updateChequeStatus
);




export default feeReceiptRoutes;
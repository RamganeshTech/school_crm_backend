import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { globalSearchController } from "../../../controllers/New_Controllers/globalController/globalSearch.controller.js";

const globalSearchRoutes = express.Router();

// Endpoint: Set or Update Fee Structure for a Class
// Access: PlatformAdmin, Correspondent, Principal
globalSearchRoutes.get(
  "/search",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  globalSearchController
);



export default globalSearchRoutes;
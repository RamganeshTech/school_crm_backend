import express from "express";
import { upload } from "../../../utils/s4UploadsNew.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import {  createBus,
 getAllBuses,
 getBusById,
 updateBus,
 deleteBus,
 deleteBusDocumentAttachment,
 getAllBusesDropDown, } from "../../../controllers/New_Controllers/transport_controller/bus.controller.js";

// upload.any() so every file (statutoryDocuments_0, statutoryDocuments_1, ...) lands in req.files as a flat array

const busRoutes = express.Router();

busRoutes.post(
  "/create",
  multiRoleAuth("administrator", "correspondent"),
  upload.any(),
  createBus
);

busRoutes.get("/", 
  
  // multiRoleAuth("administrator", "correspondent"),
      multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant"),
  
  
  getAllBuses);
busRoutes.get("/dropdown/:schoolId",
  
  // multiRoleAuth("administrator", "correspondent"),
      multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant"),

  
  getAllBusesDropDown);


busRoutes.get("/:id",
  
  // multiRoleAuth("administrator", "correspondent"),
      multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant"),

  
  getBusById);

busRoutes.put(
  "/:id",
  multiRoleAuth("administrator", "correspondent"),
  upload.any(),
  updateBus
);

busRoutes.delete("/:id", multiRoleAuth("administrator", "correspondent"), deleteBus);

busRoutes.delete(
  "/:id/documents/:documentId/files/:fileId",
  multiRoleAuth("administrator", "correspondent"),
  deleteBusDocumentAttachment
);

export default busRoutes;
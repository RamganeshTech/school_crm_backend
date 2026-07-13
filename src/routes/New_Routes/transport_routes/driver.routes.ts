import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { createDriver, deleteDriver, deleteDriverDocumentAttachment, getAllDriverDropDown, getAllDrivers, getDriverById, updateDriver } from "../../../controllers/New_Controllers/transport_controller/driver.controller.js";
import { upload } from "../../../utils/s4UploadsNew.js";

// import { manageTeacherAssignments } from "../controllers/assignmentController.js"; // Adjust path if needed
// import { multiRoleAuth } from "../middlewares/authMiddleware.js";




const driverRoutes = express.Router();
 
driverRoutes.post(
  "/create",
  multiRoleAuth("administrator", "correspondent"),
  upload.any(),
  createDriver
);
 
driverRoutes.get("/", multiRoleAuth("administrator", "correspondent"), getAllDrivers);
driverRoutes.get("/dropdown/:schoolId", multiRoleAuth("administrator", "correspondent"), getAllDriverDropDown);
 
driverRoutes.get("/:id", multiRoleAuth("administrator", "correspondent"), getDriverById);
 
driverRoutes.put(
  "/:id",
  multiRoleAuth("administrator", "correspondent"),
  upload.any(),
  updateDriver
);
 
driverRoutes.delete("/:id", multiRoleAuth("administrator", "correspondent"), deleteDriver);
 
driverRoutes.delete(
  "/:id/documents/:documentId/files/:fileId",
  multiRoleAuth("administrator", "correspondent"),
  deleteDriverDocumentAttachment
);



export default driverRoutes;
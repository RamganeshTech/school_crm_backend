import express from "express";
import {
  applyConcession, collectFeeAndManageRecord, deleteStudentRecord,
  getAllStudentRecords,
  getStudentRecordById, revertFeeTransaction,
  toggleStudentRecordStatus, updateConcessionDetails,
  uploadConcessionProof
} from "../../../../controllers/New_Controllers/studentRecord_controller/studentRecord.controller.js";
// import { upload } from "../../../../Utils/s3upload.js";
import { multiRoleAuth } from "../../../../middleware/multiRoleRequest.js";
import { upload } from "../../../../utils/s4UploadsNew.js";
import { assignStudentToClass, removeStudentFromClass } from "../../../../controllers/New_Controllers/studentRecord_controller/assignStudentClass.controller.js";
import { featureGuard } from "../../../../middleware/featureGuard.js";

const studentRecordRoutes = express.Router();



// studentRecordRoutes.post(
//   "/applyconcession",
//   multiRoleAuth("correspondent", "accountant", "principal"),
//   upload.single("file"), // Image
//   applyConcession
// );

// UPLOAD ROUTE
studentRecordRoutes.post(
  "/applyconcession",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator"),
  featureGuard("studentRecord"),
  // "files" is the key name for form-data. 10 is max count.
  upload.single("file"),
  applyConcession
);



studentRecordRoutes.put(
  "/updatevalue",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator"),
  featureGuard("studentRecord"),
  // "files" is the key name for form-data. 10 is max count.
  updateConcessionDetails
);

//  one fule only allowed, it will take the first file
studentRecordRoutes.put(
  "/update/proof",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator"),
  featureGuard("studentRecord"),
  upload.single("file"),
  uploadConcessionProof
);



studentRecordRoutes.post(
  "/collectfee",
  multiRoleAuth("correspondent", "accountant"),
  featureGuard("studentRecord"),
  upload.array("files"),
  collectFeeAndManageRecord
);


studentRecordRoutes.get(
  "/getrecord/:schoolId/:studentId",
  multiRoleAuth("administrator", "correspondent", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  featureGuard("studentRecord"),

  getStudentRecordById
);


studentRecordRoutes.get(
  "/getall",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator", "viceprincipal", "teacher", "parent"),
  featureGuard("studentRecord"),

  getAllStudentRecords
);


studentRecordRoutes.delete(
  "/deleterecord/:id",
  multiRoleAuth("correspondent"), // Only Top-Level Access
  featureGuard("studentRecord"),
  deleteStudentRecord
);


studentRecordRoutes.patch(
  "/togglestatus/:id",
  multiRoleAuth("administrator", "correspondent", "accountant", "administrator"),
  featureGuard("studentRecord"),

  toggleStudentRecordStatus
);



studentRecordRoutes.put(
  "/revertreceipt",
  multiRoleAuth("correspondent", "accountant", "principal"),
  featureGuard("studentRecord"),

  revertFeeTransaction
);




//  assing the studnet to class or remove the student from class


studentRecordRoutes.put(
  "/assign",
  multiRoleAuth("correspondent", "administrator"),
  assignStudentToClass
);




studentRecordRoutes.put(
  "/remove",
  multiRoleAuth("correspondent", "administrator"),
  removeStudentFromClass
);




export default studentRecordRoutes;
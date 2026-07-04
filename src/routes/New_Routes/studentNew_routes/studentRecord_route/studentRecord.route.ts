import express from "express";
import {
  applyConcession, applyConcessionV1, approveStudentRecordConcession, collectFeeAndManageRecord, collectFeeAndManageRecordV1, deleteStudentRecord,
  getAllStudentRecords,
  getAllStudentRecordsV1,
  getStudentRecordById, getStudentRecordByIdV1, revertFeeTransaction,
  revertFeeTransactionV1,
  toggleStudentRecordStatus, toggleStudentRecordStatusV1, updateConcessionDetails,
  updateConcessionDetailsV1,
  uploadConcessionProof
} from "../../../../controllers/New_Controllers/studentRecord_controller/studentRecord.controller.js";
// import { upload } from "../../../../Utils/s3upload.js";
import { multiRoleAuth } from "../../../../middleware/multiRoleRequest.js";
import { upload } from "../../../../utils/s4UploadsNew.js";
import { assignStudentToClass, assignStudentToClassv1, removeStudentFromClass, removeStudentFromClassv1 } from "../../../../controllers/New_Controllers/studentRecord_controller/assignStudentClass.controller.js";
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




// UPLOAD ROUTE
studentRecordRoutes.post(
  "/v1/applyconcession",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator"),
  featureGuard("studentRecord"),
  // "files" is the key name for form-data. 10 is max count.
  upload.single("file"),
  applyConcessionV1
);



studentRecordRoutes.put(
  "/v1/updatevalue",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator"),
  featureGuard("studentRecord"),
  // "files" is the key name for form-data. 10 is max count.
  updateConcessionDetailsV1
);


//  one file only allowed, it will take the first file
studentRecordRoutes.put(
  "/update/proof",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator"),
  featureGuard("studentRecord"),
  upload.single("file"),
  uploadConcessionProof
);


studentRecordRoutes.patch(
  "/v1/verify-concession/:studentId",
  multiRoleAuth("correspondent", "principal", "administrator", "viceprincipal"),
  featureGuard("studentRecord"),
  approveStudentRecordConcession
);



studentRecordRoutes.post(
  "/collectfee",
  multiRoleAuth("correspondent", "accountant", "administrator"),
  featureGuard("studentRecord"),
  upload.array("files"),
  collectFeeAndManageRecord
);



studentRecordRoutes.post(
  "/v1/collectfee",
  multiRoleAuth("correspondent", "accountant", "administrator"),
  featureGuard("studentRecord"),
  upload.array("files"),
  collectFeeAndManageRecordV1
);



studentRecordRoutes.get(
  "/getrecord/:schoolId/:studentId",
  multiRoleAuth("administrator", "correspondent", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  featureGuard("studentRecord"),

  getStudentRecordById
);

studentRecordRoutes.get(
  "/v1/getrecord/:schoolId/:studentId",
  multiRoleAuth("administrator", "correspondent", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  featureGuard("studentRecord"),

  getStudentRecordByIdV1
);


studentRecordRoutes.get(
  "/getall",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator", "viceprincipal", "teacher", "parent"),
  featureGuard("studentRecord"),

  getAllStudentRecords
);



studentRecordRoutes.get(
  "/v1/getall",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator", "viceprincipal", "teacher", "parent"),
  featureGuard("studentRecord"),
  getAllStudentRecordsV1
);


studentRecordRoutes.delete(
  "/deleterecord/:id",
  multiRoleAuth("correspondent", "administrator"), // Only Top-Level Access
  featureGuard("studentRecord"),
  deleteStudentRecord
);


studentRecordRoutes.patch(
  "/togglestatus/:id",
  multiRoleAuth("administrator", "correspondent", "accountant", ),
  featureGuard("studentRecord"),

  toggleStudentRecordStatus
);

studentRecordRoutes.patch(
  "/v1/togglestatus/:studentId",
  multiRoleAuth("administrator", "correspondent", "accountant"),
  featureGuard("studentRecord"),

  toggleStudentRecordStatusV1
);



studentRecordRoutes.put(
  "/revertreceipt",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator"),
  featureGuard("studentRecord"),

  revertFeeTransaction
);



studentRecordRoutes.put(
  "/v1/revertreceipt",
  multiRoleAuth("correspondent", "accountant", "principal", "administrator"),
  featureGuard("studentRecord"),

  revertFeeTransactionV1
);




//  assing the studnet to class or remove the student from class


studentRecordRoutes.put(
  "/assign",
  multiRoleAuth("correspondent", "administrator", "accountant"),
  assignStudentToClass
);




studentRecordRoutes.put(
  "/remove",
  multiRoleAuth("correspondent", "administrator", "accountant"),
  removeStudentFromClass
);




studentRecordRoutes.put(
  "/v1/assign",
  multiRoleAuth("correspondent", "administrator", "accountant", "teacher"),
  assignStudentToClassv1
);




studentRecordRoutes.put(
  "/v1/remove",
  multiRoleAuth("correspondent", "administrator", "accountant"),
  removeStudentFromClassv1
);




export default studentRecordRoutes;
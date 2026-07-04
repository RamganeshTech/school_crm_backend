import express from "express";
import { assignStudentToParent, createStudentProfile, deleteStudent, deleteStudentDocument, getAllPendingRequests, getAllStudents, getAllStudentsWithoutPaginationV1, getPendingRequestsForStudent, getStudentById, removeStudentFromParent, reviewProfileUpdateRequest, submitProfileUpdateRequest, updateStudent, uploadStudentFiles } from "../../../controllers/New_Controllers/studentNew_controllers/studentNew.controller.js";
// import { upload } from "../../../Utils/s3upload.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { upload } from "../../../utils/s4UploadsNew.js";
import { featureGuard } from "../../../middleware/featureGuard.js";

const studentRoutes = express.Router();

// ==============================================================================
// STUDENT PROFILE ROUTES
// ==============================================================================

// CREATE
studentRoutes.post(
  "/create",
  multiRoleAuth("correspondent", "administrator", "accountant", "teacher"),
  featureGuard("studentRecord"),

  upload.single("file"), // Image
  createStudentProfile
);

// UPDATE
studentRoutes.put(
  "/update/:id",
  multiRoleAuth("correspondent", "administrator", "accountant", "parent", "teacher"),
  featureGuard("studentRecord"),

  upload.single("file"), // Image
  updateStudent
);


studentRoutes.post(
  "/v1/upload-files/:studentId",
  multiRoleAuth("correspondent", "administrator", "accountant", "teacher"),
  featureGuard("studentRecord"),

  upload.array("files"), // Image
  uploadStudentFiles
);



// DELETE
studentRoutes.delete(
  "/v1/delete-document/:studentId/:documentId",
  multiRoleAuth("correspondent", "administrator", "accountant",),
  featureGuard("studentRecord"),

  deleteStudentDocument
);




// DELETE
studentRoutes.delete(
  "/delete/:id",
  multiRoleAuth("correspondent", "administrator"),
  featureGuard("studentRecord"),

  deleteStudent
);

// GET SINGLE
studentRoutes.get(
  "/get/:id",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  featureGuard("studentRecord"),
  getStudentById
);

// GET ALL (Filter by School, Class, Section in Query Params)
// Usage: /api/students/list?schoolId=123&classId=456&page=1&limit=20
studentRoutes.get(
  "/getall",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  featureGuard("studentRecord"),


  getAllStudents
);

studentRoutes.get(
  "/v1/without-pagination/getall",
  multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher", "parent"),
  featureGuard("studentRecord"),
  getAllStudentsWithoutPaginationV1
);



studentRoutes.put(
  "/assignstudent",
  multiRoleAuth("correspondent", "administrator", "accountant"),
  featureGuard("studentRecord"),

  assignStudentToParent
);


studentRoutes.put(
  "/removestudent",
  multiRoleAuth("correspondent", "administrator", "accountant"),
  featureGuard("studentRecord"),
  removeStudentFromParent
);




// ROUTES FOR THE STUDENT UPDATE PROFILE REQUEST BY PARENT


// --- PARENT FACING ROUTES ---

// Submit a profile update request
studentRoutes.post(
  "/request-update",
  multiRoleAuth("parent"), // Add whatever role represents parents in your system
  featureGuard("studentRecord"), // Optional based on your preference
  submitProfileUpdateRequest
);

// Get pending requests for a specific student
studentRoutes.get(
  "/pending-requests",
  multiRoleAuth("parent", "correspondent", "administrator", "principal"),
  featureGuard("studentRecord"),
  getPendingRequestsForStudent
);

// --- ADMIN FACING ROUTES ---

// Get all pending requests for the school queue
studentRoutes.get(
  "/all-pending",
  multiRoleAuth("correspondent", "administrator", "principal"),
  featureGuard("studentRecord"),
  getAllPendingRequests
);

// Approve or Reject a specific request
studentRoutes.put(
  "/review-request/:requestId",
  multiRoleAuth("correspondent", "administrator", "principal"),
  featureGuard("studentRecord"),
  reviewProfileUpdateRequest
);

export default studentRoutes;
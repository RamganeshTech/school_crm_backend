import express from "express";
import { assignStudentToParent, createStudentProfile, deleteStudent, getAllStudents, getAllStudentsWithoutPaginationV1, getStudentById, removeStudentFromParent, updateStudent } from "../../../controllers/New_Controllers/studentNew_controllers/studentNew.controller.js";
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
  multiRoleAuth("correspondent", "administrator", "accountant",),
  featureGuard("studentRecord"),

  upload.single("file"), // Image
  createStudentProfile
);

// UPDATE
studentRoutes.put(
  "/update/:id",
  multiRoleAuth("correspondent", "administrator", "accountant", "parent"),
  featureGuard("studentRecord"),

  upload.single("file"), // Image
  updateStudent
);

// DELETE
studentRoutes.delete(
  "/delete/:id",
  multiRoleAuth("correspondent"),
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
  multiRoleAuth("correspondent", "administrator"),
  featureGuard("studentRecord"),

  assignStudentToParent
);


studentRoutes.put(
  "/removestudent",
  multiRoleAuth("correspondent", "administrator"),
  featureGuard("studentRecord"),
  removeStudentFromParent
);


export default studentRoutes;
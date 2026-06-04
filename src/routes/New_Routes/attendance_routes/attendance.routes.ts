import express from "express";
import { getAcademicYearLeaderboards, getAttendanceSheet, getClassAttendanceHistory, getClassAttendanceReport, getStudentAttendanceHistory, markAttendance } from "../../../controllers/New_Controllers/attendance_controller/attendance.controller.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { featureGuard } from "../../../middleware/featureGuard.js";
// import { 
//   getAttendanceSheet, 
//   markAttendance, 
//   getStudentAttendanceReport 
// } from "../controllers/attendanceController.js";
// import { multiRoleAuth } from "../middlewares/authMiddleware.js";

const attendanceRoutes = express.Router();

// ==============================================================================
// 1. SHEET OPERATIONS (Class Level)
// ==============================================================================

// GET: Fetch the Daily Sheet (Create Mode or Edit Mode)
// Used by Teachers daily
attendanceRoutes.get(
  "/sheet",
  multiRoleAuth("administrator", "correspondent", "principal", "teacher", "parent"),
  featureGuard("attendance"),
  getAttendanceSheet
);

// POST: Mark or Update Attendance
// Used by Teachers daily
attendanceRoutes.post(
  "/mark",
  multiRoleAuth("correspondent", "teacher"),
  featureGuard("attendance"),
  markAttendance
);


attendanceRoutes.get(
  "/getallclass",
  multiRoleAuth("administrator", "correspondent", "principal", "viceprincipal", "teacher"),
  featureGuard("attendance"),
  getClassAttendanceHistory
);

// Example: GET /api/attendance/student/65a123...?month=10&year=2024
attendanceRoutes.get(
  "/student/:studentId",
  // Add your auth middleware here (ensure user is parent of this student)
  multiRoleAuth("administrator", "accountant", "correspondent", "principal", "viceprincipal", "teacher", "parent"),
  featureGuard("attendance"),
  getStudentAttendanceHistory
);


attendanceRoutes.get(
  "/report/class",
  // Add your auth middleware here (ensure user is parent of this student)
  multiRoleAuth("administrator", "accountant", "correspondent", "principal", "viceprincipal", "teacher", "parent"),
  featureGuard("attendance"),
  getClassAttendanceReport
);


attendanceRoutes.get(
  "/report/leaderboard",
  // Add your auth middleware here (ensure user is parent of this student)
  multiRoleAuth("administrator", "accountant", "correspondent", "principal", "viceprincipal", "teacher", "parent"),
  featureGuard("attendance"),
  getAcademicYearLeaderboards
);




export default attendanceRoutes;
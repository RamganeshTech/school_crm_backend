import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { createEmployeeProfile,
getAllEmployeeProfiles,
getEmployeeProfileByUserId,
updateEmployeeProfile,
deleteEmployeeProfile } from "../../../controllers/New_Controllers/user_contorllers/employeeProfile.controller.js";

const employeeProfileRoutes = express.Router();

// ==========================================
// EMPLOYEE PROFILE ROUTES
// Base URL: /api/employee-profile
// ==========================================

// 1. Create a new employee profile
employeeProfileRoutes.post(
    "/create",
    multiRoleAuth("correspondent", "administrator", ),
    createEmployeeProfile
);

// 2. Get all employee profiles (with pagination/filters)
employeeProfileRoutes.get(
    "/getall",
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher"),
    getAllEmployeeProfiles
);

// 3. Get a single employee profile by User ID
employeeProfileRoutes.get(
    "/get/:userId",
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "accountant", "teacher"),
    getEmployeeProfileByUserId
);

// 4. Update an employee profile by User ID
employeeProfileRoutes.put(
    "/update/:userId",
    multiRoleAuth("correspondent", "administrator",),
    updateEmployeeProfile
);

// 5. Soft delete (offboard) an employee profile by User ID
employeeProfileRoutes.delete(
    "/delete/:userId",
    multiRoleAuth("correspondent", "administrator",),
    deleteEmployeeProfile
);

export default employeeProfileRoutes;
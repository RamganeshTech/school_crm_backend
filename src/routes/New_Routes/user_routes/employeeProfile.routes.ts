import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { createEmployeeProfile,
getAllEmployeeProfiles,
getEmployeeProfileByUserId,
updateEmployeeProfile,
deleteEmployeeProfile, 
addEmployeeDocuments,
deleteEmployeeDocument,
addSalarySlip,
deleteSalarySlip,
upsertEmployeeProfile,
deleteSpecificDocument} from "../../../controllers/New_Controllers/user_contorllers/employeeProfile.controller.js";
import { upload } from "../../../utils/s4UploadsNew.js";


const employeeProfileRoutes = express.Router();

// ==========================================
// EMPLOYEE PROFILE ROUTES
// Base URL: /api/employee-profile
// ==========================================

// 1. Create a new employee profile
employeeProfileRoutes.post(
    "/create",
    multiRoleAuth("correspondent", "administrator", "teacher", "accountant", "viceprincipal", "principal"),
    upload.array("files"), // 'attachments' is the key name in Postman
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
    multiRoleAuth("correspondent", "administrator", "teacher", "accountant", "viceprincipal", "principal"),
    updateEmployeeProfile
);

// 5. Soft delete (offboard) an employee profile by User ID
employeeProfileRoutes.delete(
    "/delete/:userId",
    multiRoleAuth("correspondent", "administrator"),
    deleteEmployeeProfile
);

// 3. Add documents to an existing profile (multiple files in one go)
employeeProfileRoutes.post(
    "/:userId/documents",
    multiRoleAuth("correspondent", "administrator", "teacher", "accountant", "viceprincipal", "principal"),
    upload.array("files"),
    addEmployeeDocuments
);

// 4. Delete a single document from a profile
employeeProfileRoutes.delete(
    "/:userId/documents/:documentId",
    multiRoleAuth("correspondent", "administrator", "teacher", "accountant", "viceprincipal", "principal"),
    deleteEmployeeDocument
);


employeeProfileRoutes.post(
    "/:userId/salary-slips",
    multiRoleAuth("correspondent", "administrator", "teacher", "accountant", "viceprincipal", "principal"),
    upload.single("file"),
    addSalarySlip
);

employeeProfileRoutes.delete(
    "/:userId/salary-slips/:slipId",
    multiRoleAuth("correspondent", "administrator", "teacher", "accountant", "viceprincipal", "principal"),
    deleteSalarySlip
);


employeeProfileRoutes.post(
    "/:userId/upsert",
    multiRoleAuth("correspondent", "administrator", "teacher", "accountant", "viceprincipal", "principal"),
    upload.fields([
        { name: "documents",  },
        { name: "panDocument", maxCount: 1 },
        { name: "aadhaarDocument", maxCount: 1 },
        { name: "appointmentLetter", maxCount: 1 }, // 👈 ADD THIS LINE
        { name: "salarySlipFile",  }
    ]),
    upsertEmployeeProfile
);


employeeProfileRoutes.delete(
    "/:userId/delete-specific-document",
    multiRoleAuth("correspondent", "administrator", "teacher", "accountant", "viceprincipal", "principal"),
    deleteSpecificDocument
);


export default employeeProfileRoutes;
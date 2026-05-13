import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getAllClassesWithSections, manageTeacherAssignments } from "../../../controllers/New_Controllers/teachers_controllers/teachers.controllers.js";

// import { manageTeacherAssignments } from "../controllers/assignmentController.js"; // Adjust path if needed
// import { multiRoleAuth } from "../middlewares/authMiddleware.js";

const teacherRoutes = express.Router();

// ... (Your existing create/update/get routes) ...


// ==============================================================================
// TEACHER ASSIGNMENT ROUTES
// ==============================================================================

// Endpoint: Manage Class/Section Assignments (Toggle Add/Remove)
// Access: PlatformAdmin, SuperAdmin, Correspondent, Principal
teacherRoutes.post(
    "/assignments/manage",
    //   multiRoleAuth("PlatformAdmin", "SuperAdmin", "Correspondent", "Principal"), 
    multiRoleAuth("correspondent", "administrator",),
    manageTeacherAssignments
);

teacherRoutes.get(
    "/getall/class/section",
    //   multiRoleAuth("PlatformAdmin", "SuperAdmin", "Correspondent", "Principal"), 
    multiRoleAuth("correspondent", "administrator", "accountant", "teacher", "principal", "viceprincipal"),
    getAllClassesWithSections
);






export default teacherRoutes;
import express from "express";
import {
    createClass,
    getClasses,
    updateClass,
    deleteClass
} from "../../../../controllers/New_Controllers/school_controllers/class_controllers/class.controllers.js";
import { multiRoleAuth } from "../../../../middleware/multiRoleRequest.js";

const classRoutes = express.Router();

// READ: Teachers and Admins can view classes
classRoutes.get(
    "/getall/:schoolId",
    multiRoleAuth("correspondent", "teacher", "principal", "administrator", "viceprincipal", "accountant"),
    getClasses
);

// CREATE: Only Admins/Principals
classRoutes.post(
    "/create/:schoolId",
    multiRoleAuth("correspondent", "administrator","teacher"),
    createClass
);

// UPDATE
classRoutes.put(
    "/update/:id",
    multiRoleAuth("correspondent", "administrator","teacher"),
    updateClass
);

// DELETE
classRoutes.delete(
    "/delete/:id",
    multiRoleAuth("correspondent", "administrator","teacher"),
    deleteClass
);

export default classRoutes;
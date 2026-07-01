import express from "express";

import { multiRoleAuth } from "../../../../middleware/multiRoleRequest.js";
import { createSection, deleteSection, getSections, updateSection } from "../../../../controllers/New_Controllers/school_controllers/section_controllers/section.controllers.js";

const sectionRoutes = express.Router();


sectionRoutes.get(
  "/getall",
  multiRoleAuth("correspondent", "teacher", "principal", "administrator", "viceprincipal", "accountant"),
  getSections
);

sectionRoutes.post(
  "/create",
  multiRoleAuth("correspondent", "administrator",),
  createSection
);


sectionRoutes.put(
  "/update/:id",
  multiRoleAuth("correspondent", "administrator",),
  updateSection
);

sectionRoutes.delete(
  "/delete/:id",
  multiRoleAuth("correspondent", "administrator"),
  deleteSection
);

export default sectionRoutes;
import express from "express";
import { addHomeworkAttachments, createHomework, deleteDailyHomework, deleteHomeworkAttachment, deleteSubjectFromHomework, getAllHomework, getSingleHomework, updateHomeworkText } from "../../../controllers/New_Controllers/HomeWork_controller/HomeWork.controller.js";
import { upload } from "../../../utils/s4UploadsNew.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";

const HomeWorkRoutes = express.Router();

HomeWorkRoutes.post("/create", multiRoleAuth("correspondent", "teacher"), upload.array("files"), createHomework);

// Update Routes
HomeWorkRoutes.put("/updatetext", multiRoleAuth("correspondent", "teacher"), updateHomeworkText);
HomeWorkRoutes.put("/addattachments", multiRoleAuth("correspondent", "teacher"), upload.array("files"), addHomeworkAttachments);

// Delete Routes
HomeWorkRoutes.delete("/deletesubject", multiRoleAuth("correspondent", "teacher"), deleteSubjectFromHomework); // Deletes whole subject
HomeWorkRoutes.delete("/deleteattachment", multiRoleAuth("correspondent", "teacher"), deleteHomeworkAttachment); // Deletes one file

// Fetch Routes
HomeWorkRoutes.get("/getall", multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), getAllHomework);

HomeWorkRoutes.get("/getsingle/:homeworkId", multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), getSingleHomework);

// DELETE entire day's record
HomeWorkRoutes.delete("/deleteentireday", multiRoleAuth("correspondent", "teacher"), deleteDailyHomework);


export default HomeWorkRoutes;
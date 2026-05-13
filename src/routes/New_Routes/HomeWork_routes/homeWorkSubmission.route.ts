import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { getAllHomeworkSubmissionsWithoutPaginations, getAllHomeworkSubmissionsWithPaginations, getSingleHomeworkSubmission, submitHomeworkStatus } from "../../../controllers/New_Controllers/HomeWork_controller/HomeWorkSubmission.controller.js";

const HomeWorkSubmissionRoutes = express.Router();

HomeWorkSubmissionRoutes.post("/submit", multiRoleAuth("correspondent", "parent"), submitHomeworkStatus);

// Fetch Routes
HomeWorkSubmissionRoutes.get("/getall", multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), getAllHomeworkSubmissionsWithPaginations);
HomeWorkSubmissionRoutes.get("/getall-without-pagination", multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), getAllHomeworkSubmissionsWithoutPaginations);

HomeWorkSubmissionRoutes.get("/getsingle/:id", multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), getSingleHomeworkSubmission);


export default HomeWorkSubmissionRoutes;
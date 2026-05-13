// Routes/deleteArchiveRoutes.js
import express from "express";
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';
import { deletePermanently, getAllDeletedItems, getDeletedItemById } from "../../../controllers/New_Controllers/deleteArchieve_controller/deleteArchieve.controller.js";
// import { deletePermanently, getAllDeletedItems, getDeletedItemById } from "../../../Controllers/New_Controllers/deleteArchieve_controller/deleteArchieve.controller.js";

const deleteArchiveRoutes = express.Router();

deleteArchiveRoutes.get("/getall", multiRoleAuth("correspondent", "accountant", "principal", "viceprincipal"), getAllDeletedItems);

deleteArchiveRoutes.get("/get/:id", multiRoleAuth("correspondent", "accountant", "principal", "viceprincipal"), getDeletedItemById);

deleteArchiveRoutes.delete("/delete/:id", multiRoleAuth("correspondent"), deletePermanently);


export default deleteArchiveRoutes;
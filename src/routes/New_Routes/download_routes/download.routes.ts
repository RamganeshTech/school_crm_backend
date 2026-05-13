import express from "express";
import { downloadProof } from "../../../controllers/New_Controllers/download_controller/download.controller.js";

const downloadRoutes = express.Router();

// DOWNLOAD ROUTE
// Usage: GET /downloadproof?key=images/1234-uuid.jpg
downloadRoutes.get(
  "/",
  // You probably want auth here too so strangers can't download school files
  downloadProof
);

export default downloadRoutes;

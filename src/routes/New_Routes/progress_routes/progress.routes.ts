import express from 'express';
import { getSchoolSetupStatus } from '../../../controllers/New_Controllers/progress_controller/progress.controller.js';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';

const ProgressBarRoutes = express.Router();

// 1. Create a new Bill Book
ProgressBarRoutes.get(
    '/get-progress',
    multiRoleAuth("correspondent", "administrator"),
    getSchoolSetupStatus
);


export default ProgressBarRoutes;
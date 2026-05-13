import express from 'express';

// Adjust these imports based on your actual middleware locations
import {
    createMarkReport,
    getAllMarkReports,
    updateMarkReport,
    deleteMarkReport,
    getMarkReportById
} from '../../../controllers/New_Controllers/markReportCard_controllers/markReportCard.controller.js';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';

const markReportRoutes = express.Router();

// ==========================================
// 1. CREATE MARK REPORT
// ==========================================
markReportRoutes.post('/create',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    // featureGuard("marks"), // Adjust this feature name to match your database settings
    createMarkReport
);

// ==========================================
// 2. GET ALL MARK REPORTS
// ==========================================
markReportRoutes.get('/get-all',
    // Parents and students typically need read-only access to their own marks
    multiRoleAuth("correspondent", "administrator", "principal", "teacher", "parent", "viceprincipal"),
    // featureGuard("marks"),
    getAllMarkReports
);

// ==========================================
// 3. UPDATE MARK REPORT
// ==========================================
markReportRoutes.put('/update/:reportId',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    // featureGuard("marks"),
    updateMarkReport
);

// ==========================================
// 4. DELETE MARK REPORT
// ==========================================
markReportRoutes.delete('/delete/:reportId',
    // It's usually safer to restrict deletions to higher-level admin roles
    multiRoleAuth("correspondent", "administrator", "teacher"),
    // featureGuard("marks"),
    deleteMarkReport
);

markReportRoutes.get('/get/:reportId',
    multiRoleAuth("correspondent", "administrator", "principal", "teacher", "parent", "viceprincipal"),
    // featureGuard("marks"),
    getMarkReportById
);



export default markReportRoutes;
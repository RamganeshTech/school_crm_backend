import express from 'express';

// Adjust these imports based on your actual middleware locations
import {
    createMarkReport,
    getAllMarkReports,
    updateMarkReport,
    deleteMarkReport,
    getMarkReportById,
    getMarkReportByIdV1
} from '../../../controllers/New_Controllers/markReportCard_controllers/markReportCardv1.controller.js';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';

const markReportRoutesV1 = express.Router();

// ==========================================
// 1. CREATE MARK REPORT
// ==========================================
markReportRoutesV1.post('/create',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    // featureGuard("marks"), // Adjust this feature name to match your database settings
    createMarkReport
);

// ==========================================
// 2. GET ALL MARK REPORTS
// ==========================================
markReportRoutesV1.get('/get-all',
    // Parents and students typically need read-only access to their own marks
    multiRoleAuth("correspondent", "administrator", "principal", "teacher", "parent", "viceprincipal"),
    // featureGuard("marks"),
    getAllMarkReports
);

// ==========================================
// 3. UPDATE MARK REPORT
// ==========================================
markReportRoutesV1.put('/update/:reportId',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    // featureGuard("marks"),
    updateMarkReport
);

// ==========================================
// 4. DELETE MARK REPORT
// ==========================================
markReportRoutesV1.delete('/delete/:reportId',
    // It's usually safer to restrict deletions to higher-level admin roles
    multiRoleAuth("correspondent", "administrator", "teacher",),
    // featureGuard("marks"),
    deleteMarkReport
);

markReportRoutesV1.get('/get/:reportId',
    multiRoleAuth("correspondent", "administrator", "principal", "teacher", "parent", "viceprincipal"),
    // featureGuard("marks"),
    getMarkReportById
);


markReportRoutesV1.get('/get/student/:studentId',
    multiRoleAuth("correspondent", "administrator", "principal", "teacher", "parent", "viceprincipal"),
    // featureGuard("marks"),
    getMarkReportByIdV1
);

export default markReportRoutesV1;
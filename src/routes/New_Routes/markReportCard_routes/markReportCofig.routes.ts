import express from 'express';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';
import { createMarkReportConfig, 
getMarkReportConfigByClass, 
updateMarkReportConfig  } from '../../../controllers/New_Controllers/markReportCard_controllers/markReportConfig.controller.js';
// import { multiRoleAuth } from '../middleware/authMiddleware.js'; // Adjust path
// import { 
//     createMarkReportConfig, 
//     getMarkReportConfigByClass, 
//     updateMarkReportConfig 
// } from '; // Adjust path

const markReportConfigRoutes = express.Router();

// ==========================================
// 1. CREATE CONFIGURATION TEMPLATE
// ==========================================
// Only high-level administration should define the school's exam structures
markReportConfigRoutes.post('/create',
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal"),
    // featureGuard("marks_setup"), 
    createMarkReportConfig
);

// ==========================================
// 2. GET CONFIGURATION BY CLASS
// ==========================================
// Everyone needs to read this so the React UI can draw the table headers correctly
markReportConfigRoutes.get('/by-class',
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "teacher", "parent"),
    // featureGuard("marks"), 
    getMarkReportConfigByClass
);

// ==========================================
// 3. UPDATE CONFIGURATION TEMPLATE
// ==========================================
// Updating exams/subjects mid-year is also an administrative action
markReportConfigRoutes.put('/update/:configId',
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal"),
    // featureGuard("marks_setup"), 
    updateMarkReportConfig
);

export default markReportConfigRoutes;
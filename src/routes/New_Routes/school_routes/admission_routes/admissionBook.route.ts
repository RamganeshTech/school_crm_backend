import express from 'express';
// Adjust the import paths based on your actual folder structure
// import { 
//     createAdmissionBook, 
//     getAllAdmissionBooks, 
//     updateAdmissionBook, 
//     editFormNumber 
// } from '../controllers/admissionBook.controller'; 
// import { multiRoleAuth } from '../middlewares/auth.middleware'; 
import {  createAdmissionBook, 
 getAllAdmissionBooks, 
 updateAdmissionBook, 
 editFormNumber,  
 deleteAdmissionBook} from '../../../../controllers/New_Controllers/school_controllers/admission_controllers/admissionBook.controller.js';
import { multiRoleAuth } from '../../../../middleware/multiRoleRequest.js';

const schoolAdmissionBookRoutes = express.Router();

// ==========================================
// BASE ROUTE: /api/school-config/admission-book
// ROLE ACCESS: Correspondent & Administrator ONLY
// ==========================================

// 1. Create a new Admission Book
schoolAdmissionBookRoutes.post(
    '/', 
    multiRoleAuth("correspondent", "administrator"), 
    createAdmissionBook
);

// 2. Get all Admission Books for a specific school
schoolAdmissionBookRoutes.get(
    '/:schoolId', 
    multiRoleAuth("correspondent", "administrator"), 
    getAllAdmissionBooks
);

// 3. Update Admission Book (Name & Active Status)
schoolAdmissionBookRoutes.patch(
    '/:id', 
    multiRoleAuth("correspondent", "administrator"), 
    updateAdmissionBook
);

// 4. Manually Edit the starting Form Sequence Number
schoolAdmissionBookRoutes.patch(
    '/:id/sequence', 
    multiRoleAuth("correspondent", "administrator"), 
    editFormNumber
);

// 5. Delete an inactive Admission Book
schoolAdmissionBookRoutes.delete(
    '/:id', 
    multiRoleAuth("correspondent", "administrator"), 
    deleteAdmissionBook
);

export default schoolAdmissionBookRoutes;
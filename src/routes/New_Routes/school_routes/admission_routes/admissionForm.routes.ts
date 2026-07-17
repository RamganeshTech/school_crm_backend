import express from 'express';
import { multiRoleAuth } from '../../../../middleware/multiRoleRequest.js';
import { getAllAdmissionForms, submitPublicAdmissionForm, 
 getSingleAdmissionForm, 
 deleteAdmissionForm,  
 updateAdmissionFormStatus,
 generateAdmissionLink,
 linkStudentToAdmissionForm,
 updateAdmissionFormDetails,
 getAdmissionFormsForDropdown} from '../../../../controllers/New_Controllers/school_controllers/admission_controllers/admissionForm.controller.js';
// Adjust paths according to your structure
// import { 
//     getAllAdmissionForms, 
//     getSingleAdmissionForm, 
//     deleteAdmissionForm 
// } from '../controllers/admissionForm.controller';
// import { multiRoleAuth } from '../middlewares/auth.middleware';

const schoolAdmissionFormRoutes = express.Router();

// ==========================================
// BASE ROUTE: /api/school/admission-form
// ROLE ACCESS: Correspondent & Administrator
// ==========================================
schoolAdmissionFormRoutes.post(
    '/generate-link', 
    multiRoleAuth("correspondent", "administrator", "principal"), 
    generateAdmissionLink
);

schoolAdmissionFormRoutes.put('/admissions/submit/:id', submitPublicAdmissionForm);




schoolAdmissionFormRoutes.get(
    '/dropdown', 
    multiRoleAuth("correspondent", "administrator", "principal"), 
    getAdmissionFormsForDropdown
);

// 2. Get a SINGLE admission form by its ID
schoolAdmissionFormRoutes.get(
    '/form', 
    multiRoleAuth("correspondent", "administrator", "principal"), 
    getSingleAdmissionForm
);

// 1. Get ALL admission forms for a school (Supports optional ?status= query)
schoolAdmissionFormRoutes.get(
    '/:schoolId', 
    multiRoleAuth("correspondent", "administrator", "principal"), 
    getAllAdmissionForms
);

// 3. Delete an admission form
schoolAdmissionFormRoutes.delete(
    '/:id', 
    multiRoleAuth("correspondent", "administrator", "principal"), 
    deleteAdmissionForm
);

schoolAdmissionFormRoutes.patch(
    '/status', 
    multiRoleAuth("correspondent", "administrator", "principal"), 
    updateAdmissionFormStatus
);

// Admin Update Form Details (via Query Params)
schoolAdmissionFormRoutes.put(
    '/details', 
    multiRoleAuth("correspondent", "administrator", "principal"), 
    updateAdmissionFormDetails
);

schoolAdmissionFormRoutes.patch(
    '/:id/link-student', 
    multiRoleAuth("correspondent", "administrator", "principal"), 
    linkStudentToAdmissionForm
);

export default schoolAdmissionFormRoutes;
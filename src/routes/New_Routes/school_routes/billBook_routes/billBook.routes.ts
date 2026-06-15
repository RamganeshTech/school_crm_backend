import express from 'express';
import { multiRoleAuth } from '../../../../middleware/multiRoleRequest.js';
import {
    createBillBook,
    getAllBillBooks,
    updateBillBook,
    editBillNumber
} from '../../../../controllers/New_Controllers/school_controllers/billBook_controller/billBook.controller.js';
// Adjust the import paths based on your actual folder structure
// import { 
//     createBillBook, 
//     getAllBillBooks, 
//     updateBillBook, 
//     editBillNumber 
// } from '; 
// import { multiRoleAuth } from '../middlewares/auth.middleware'; 

const schoolBillBookRoutes = express.Router();

// ==========================================
// BASE ROUTE: /api/school-config/bill-book
// ROLE ACCESS: Correspondent & Administrator ONLY
// ==========================================

// 1. Create a new Bill Book
schoolBillBookRoutes.post(
    '/',
    multiRoleAuth("correspondent", "administrator"),
    createBillBook
);

// 2. Get all Bill Books for a specific school
schoolBillBookRoutes.get(
    '/:schoolId',
    multiRoleAuth("correspondent", "administrator"),
    getAllBillBooks
);

// 3. Update Bill Book (Name & Active Status)
schoolBillBookRoutes.patch(
    '/:id',
    multiRoleAuth("correspondent", "administrator"),
    updateBillBook
);

// 4. Manually Edit the starting Sequence Number
schoolBillBookRoutes.patch(
    '/:id/sequence',
    multiRoleAuth("correspondent", "administrator"),
    editBillNumber
);

export default schoolBillBookRoutes;
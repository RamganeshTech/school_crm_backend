import express from 'express';
import { multiRoleAuth } from '../../../../middleware/multiRoleRequest.js';
import {
    createBillBook,
    getAllBillBooks,
    updateBillBook,
    editBillNumber,
    deleteBillBook
} from '../../../../controllers/New_Controllers/school_controllers/billBook_controller/billBook.controller.js';
import { getBillRecords } from '../../../../controllers/New_Controllers/school_controllers/billBook_controller/billBookRecord.controller.js';
// Adjust the import paths based on your actual folder structure
// import { 
//     createBillBook, 
//     getAllBillBooks, 
//     updateBillBook, 
//     editBillNumber 
// } from '; 
// import { multiRoleAuth } from '../middlewares/auth.middleware'; 

const billBookRecordRoutes = express.Router();


// 2. Get all Bill Books for a specific school
billBookRecordRoutes.get(
    '/get',
    multiRoleAuth("correspondent", "administrator", "accountant", "principal"),
    getBillRecords
);


export default billBookRecordRoutes;
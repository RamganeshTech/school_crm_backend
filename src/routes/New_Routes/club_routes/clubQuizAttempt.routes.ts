import express from 'express';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';
import { featureGuard } from '../../../middleware/featureGuard.js';
import { createQuizAttempt, deleteAttempt, getAllAttempts, getSingleAttempt } from '../../../controllers/New_Controllers/club_controllers/clubQuizAttempt.controller.js';

const clubQuizAttemptRoutes = express.Router();

clubQuizAttemptRoutes.post('/create',
    multiRoleAuth("correspondent", "administrator", "teacher", "parent"),
    featureGuard("club"),
    createQuizAttempt);


clubQuizAttemptRoutes.get('/getall',
    multiRoleAuth("correspondent", "principal", "teacher", "parent", "administrator", "accountant", "viceprincipal"),
    featureGuard("club"),
    getAllAttempts);

clubQuizAttemptRoutes.get('/get/:id',
    multiRoleAuth("correspondent", "principal", "teacher", "parent", "administrator", "accountant", "viceprincipal"),
    featureGuard("club"),
    getSingleAttempt);


clubQuizAttemptRoutes.delete('/delete/:id',
    multiRoleAuth("correspondent", "administrator",),
    featureGuard("club"),
    deleteAttempt);


export default clubQuizAttemptRoutes;
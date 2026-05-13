import express from 'express';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';
import { featureGuard } from '../../../middleware/featureGuard.js';
import { createClubQuiz, createQuizWithAI, deleteClubQuiz, getAllClubQuizzes, getSingleClubQuiz, updateClubQuiz } from '../../../controllers/New_Controllers/club_controllers/clubQuiz.controller.js';

const clubQuizRoutes = express.Router();

clubQuizRoutes.post('/create',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    featureGuard("club"),
    createClubQuiz);


clubQuizRoutes.put('/update/:id',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    featureGuard("club"),
    updateClubQuiz);


clubQuizRoutes.get('/getall',
    multiRoleAuth("correspondent", "principal", "teacher", "parent", "administrator", "accountant", "viceprincipal"),
    featureGuard("club"),
    getAllClubQuizzes);

clubQuizRoutes.get('/get/:id',
    multiRoleAuth("correspondent", "principal", "teacher", "parent", "administrator", "accountant", "viceprincipal"),
    featureGuard("club"),
    getSingleClubQuiz);


// Delete Club (and cascades to delete videos)
clubQuizRoutes.delete('/delete/:id',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    featureGuard("club"),
    deleteClubQuiz);



clubQuizRoutes.post('/create/ai',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    featureGuard("club"),
    createQuizWithAI);




export default clubQuizRoutes;
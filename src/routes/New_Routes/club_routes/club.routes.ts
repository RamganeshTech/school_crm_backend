import express from 'express';
import { addStudentToClub, createClub, deleteClub, getAllClubs, getClubById, removeStudentFromClub, toggleClassStudentsToClub, updateClubText, updateClubThumbnail } from '../../../controllers/New_Controllers/club_controllers/club.controller.js';
import { createClubVideo, deleteClubVideo, deleteClubVideoFile, getAllClubVideos, getClubVideoById, updateClubVideoDetails, updateClubVideoFile, uploadClubPDF } from '../../../controllers/New_Controllers/club_controllers/clubVideo.controller.js';
import { upload } from '../../../utils/s4UploadsNew.js';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';
import { featureGuard } from '../../../middleware/featureGuard.js';

const clubRoutes = express.Router();

// ==========================================
// PUBLIC / VIEW ROUTES
// ==========================================
// Get all clubs (Supports pagination ?page=1&limit=10&schoolId=...)
clubRoutes.get('/getall',

    multiRoleAuth("correspondent", "principal", "teacher", "parent", "administrator", "accountant", "viceprincipal"),
    featureGuard("club"),

    getAllClubs);

// Get single club details
clubRoutes.get('/get/:id',
    multiRoleAuth("correspondent", "principal", "teacher", "parent", "administrator", "accountant", "viceprincipal"),
    featureGuard("club"),

    getClubById);


// ==========================================
// ADMIN / MANAGEMENT ROUTES
// ==========================================

// Create a new Club (Multipart form-data: fields + 'thumbnail' file)
clubRoutes.post('/create',
    multiRoleAuth("correspondent", "administrator"),
    featureGuard("club"),

    upload.single('thumbnail'),

    createClub);

// Update text details only (Name, Description, isActive)
clubRoutes.put('/updatetext/:id',
    multiRoleAuth("correspondent", "administrator"),
    featureGuard("club"),

    updateClubText);

// Update thumbnail only (Multipart form-data: 'thumbnail' file)
clubRoutes.put('/updatethumbnail/:id',
    multiRoleAuth("correspondent", "administrator"),
    upload.single('thumbnail'),
    featureGuard("club"),


    updateClubThumbnail);

// Delete Club (and cascades to delete videos)
clubRoutes.delete('/delete/:id',
    multiRoleAuth("correspondent", "administrator"),
    featureGuard("club"),

    deleteClub);




// Delete Club (and cascades to delete videos)
clubRoutes.put('/addtoclub',
    multiRoleAuth("correspondent", "administrator",),
    featureGuard("club"),

    addStudentToClub);



// Delete Club (and cascades to delete videos)
clubRoutes.put('/removefromclub',
    multiRoleAuth("correspondent", "administrator"),
    featureGuard("club"),

    removeStudentFromClub);


clubRoutes.put('/toggleclub/student',
    multiRoleAuth("correspondent", "administrator"),
    featureGuard("club"),

    toggleClassStudentsToClub);




// ==========================================
// VIEW ROUTES
// ==========================================
// Get videos (Supports pagination ?clubId=...&page=1)

// {{baseURL}}/api/club/video/getall?clubId=694a3de7e615dd6fec381c3e&page=1&limit=10

clubRoutes.get('/video/getall',
    multiRoleAuth("correspondent", "principal", "teacher", "parent", "administrator", "accountant", "viceprincipal"),

    featureGuard("club"),
    getAllClubVideos);

// Get single video details
clubRoutes.get('/video/get/:id',
    multiRoleAuth("correspondent", "principal", "teacher", "parent", "administrator", "accountant", "viceprincipal"),

    featureGuard("club"),
    getClubVideoById);
// {{baseURL}}/api/club/video/get/


// ==========================================
// MANAGEMENT ROUTES
// ==========================================

// Upload a new Video (Multipart form-data: fields + 'video' file)
// {{baseURL}}/api/club/video/upload/

clubRoutes.post('/video/upload',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    // upload.single('video'),

    upload.fields([
        { name: 'video', maxCount: 1 }, 
        { name: 'pdf' } // Increase maxCount if you want to allow multiple PDFs at once
    ]),

    featureGuard("club"),
    createClubVideo);

// Update details only (Title, Topic, Level) - No file upload here
clubRoutes.put('/video/updatedetails/:id',
    multiRoleAuth("correspondent", "administrator", "teacher"),

    featureGuard("club"),
    updateClubVideoDetails);

clubRoutes.put('/video/upload-pdf/:id',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    upload.array("files"),
    featureGuard("club"),
    uploadClubPDF);




// Update VIDEO FILE only (Multipart form-data: 'video' file) - Re-uploads the file
clubRoutes.put('/video/updatefile/:id',
    multiRoleAuth("correspondent", "administrator", "teacher"),
    upload.single('video'),

    featureGuard("club"),
    updateClubVideoFile);

clubRoutes.delete('/video/deletefile/:id/:fileId',
    multiRoleAuth("correspondent", "administrator", "teacher"),

    featureGuard("club"),
    deleteClubVideoFile);

// Delete Video
clubRoutes.delete('/video/delete/:id',
    multiRoleAuth("correspondent", "administrator"),

    featureGuard("club"),
    deleteClubVideo);

export default clubRoutes;
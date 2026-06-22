import express from 'express'
// import { upload } from '../Utils/s3upload'
import { createSchool, deleteAcademicTermDates, deleteSchool, getAllSchools, getSchoolById, getSchoolSocialPlatforms, updateSchool, updateSchoolLogo, updateSocialPlatform, upsertAcademicTermDates } from '../../../controllers/New_Controllers/school_controllers/school.controllers.js';
// import { upload } from '../../../Utils/s3upload.js';
// import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';
import { upload } from '../../../utils/s4UploadsNew.js';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';

const schoolRoutes = express.Router()

schoolRoutes.post('/create',
    multiRoleAuth("correspondent"),
    upload.single('file'), createSchool);

schoolRoutes.get('/getall',
    multiRoleAuth("correspondent"),
    getAllSchools);

schoolRoutes.get('/getsingle/:id',
    multiRoleAuth("correspondent", "teacher", "principal", "parent", "administrator", "viceprincipal", "accountant"),
    getSchoolById);

schoolRoutes.put('/update/:id',
    multiRoleAuth("correspondent"),
    updateSchool);

schoolRoutes.put('/updatelogo/:id',
    multiRoleAuth("correspondent"),
    upload.single('file'),
    updateSchoolLogo);

schoolRoutes.delete('/delete/:id',
    multiRoleAuth("correspondent"),
    deleteSchool);





schoolRoutes.put('/update/socialplatform/:id',
    multiRoleAuth("correspondent", "administrator"),
    updateSocialPlatform);



schoolRoutes.get('/getschool/socialplatform/:id',
    multiRoleAuth("correspondent", "teacher", "parent", "principal", "administrator", "viceprincipal", "accountant"),
    getSchoolSocialPlatforms);


//  academic term date config



schoolRoutes.put('/update/academic-termdate/:id',
    multiRoleAuth("correspondent", "administrator"),
    upsertAcademicTermDates);



schoolRoutes.delete('/delete/academic-termdate/:schoolId/:academicTermDateId',
    multiRoleAuth("correspondent", "administrator"),
    deleteAcademicTermDates);


export default schoolRoutes;
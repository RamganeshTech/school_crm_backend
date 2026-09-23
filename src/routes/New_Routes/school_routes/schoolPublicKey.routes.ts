import express from 'express';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';
import { getSchoolPublicKeyV1, upsertSchoolPublicKeyV1 } from '../../../controllers/New_Controllers/school_controllers/schoolPublicKey.controller.js';

const schoolPubllicKeyRoutes = express.Router();


// GET: Fetch the active public key for a school
schoolPubllicKeyRoutes.get(
    '/:schoolId',
    multiRoleAuth( "correspondent", 
    "principal", 
    "administrator", 
    "viceprincipal", 
    "accountant"),
    getSchoolPublicKeyV1
);

// POST: Upsert (Register or Rotate) the public key for a school
schoolPubllicKeyRoutes.post(
    '/:schoolId',
    multiRoleAuth( "correspondent", 
    "principal", 
    "administrator", 
    "viceprincipal", 
    "accountant"),
    upsertSchoolPublicKeyV1
);

export default schoolPubllicKeyRoutes;
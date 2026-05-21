import express from 'express'
import { assignRolesToUser, createUser, deleteUser, isAuthenticated, loginUser, logoutUser, updateUser, getParentStudents, createUserV1 } from '../../../controllers/New_Controllers/user_contorllers/user.controllers.js';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';
import { getSingleUser, getUsersBySchool } from '../../../controllers/New_Controllers/user_contorllers/userUtil.controller.js';

const userRoutes = express.Router()

// but this is old , belwo normal '/create' is the new one 
userRoutes.post('/v1/create', multiRoleAuth("correspondent", "administrator"), createUser);
userRoutes.post('/create', multiRoleAuth("correspondent", "administrator"), createUserV1);

userRoutes.post('/login', loginUser);
userRoutes.post('/logout', logoutUser);
userRoutes.get('/isauthenticated',
    multiRoleAuth("correspondent", "teacher", "principal", "parent", "accountant", "administrator", "viceprincipal"),
    isAuthenticated);

userRoutes.delete("/delete/:id",
    multiRoleAuth("correspondent"),
    deleteUser);

userRoutes.put("/update/:id",
    multiRoleAuth("correspondent", "teacher", "principal", "parent", "accountant", "administrator", "viceprincipal"),
    updateUser);




//  new route (in role  if you send the all in the role params , then youll get all the users irrespective of role)
userRoutes.get(
    "/:role/:schoolId",
    multiRoleAuth("correspondent", "teacher", "principal", "parent", "accountant", "administrator", "viceprincipal"),
    getUsersBySchool
);

userRoutes.get(
    "/:userId",
    multiRoleAuth("correspondent", "teacher", "principal", "administrator", "viceprincipal", "parent", "accountant"),
    getSingleUser
);


userRoutes.put(
    "/assignrole/:userId",
    multiRoleAuth("correspondent", "administrator"),
    assignRolesToUser
);



userRoutes.get(
    "/associated-students/get/:userId",
    multiRoleAuth("correspondent", "administrator", "parent"),
    getParentStudents
);





export default userRoutes;
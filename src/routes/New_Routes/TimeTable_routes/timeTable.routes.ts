import express from "express";
import { addDay, deleteDay, deleteSinglePeriod, deleteTimeTable, getTeacherSchedule, getTimeTables, updateDayName, updatePeriodTeacher, upsertPeriod } from "../../../controllers/New_Controllers/timeTable_controllers/timeTable.controllers.js";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";

const timeTableRoutes = express.Router();

// Add new period (Auto-Inits if table/day doesn't exist)
//  WEEEK RELATED
timeTableRoutes.post("/addday", multiRoleAuth("administrator", "correspondent"), addDay);

timeTableRoutes.put(
    "/updateday",
    multiRoleAuth("correspondent", "administrator"),
    updateDayName
);

timeTableRoutes.delete(
    "/deleteday",
    multiRoleAuth("correspondent", "administrator"),
    deleteDay
);



//  PERIOD RELATED

// Update details of an existing period
timeTableRoutes.put("/updateperiod", multiRoleAuth("administrator", "correspondent"), upsertPeriod);

timeTableRoutes.delete("/deleteperiod", multiRoleAuth("administrator", "correspondent"), deleteSinglePeriod);




// ==========================================
// 2. GET TIMETABLES (Full list or filtered)
// ==========================================
timeTableRoutes.get(
    "/getall",
    multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"),
    getTimeTables
);

// ==========================================
// 3. GET TEACHER SPECIFIC SCHEDULE
// ==========================================
// Logic: Shows a teacher where they need to be throughout the week
timeTableRoutes.get(
    "/teacherschedule",
    multiRoleAuth("correspondent", "administrator", "principal", "viceprincipal", "teacher"),
    getTeacherSchedule
);


timeTableRoutes.put(
    "/assignteacher",
    multiRoleAuth("correspondent", "administrator", "principal"),
    updatePeriodTeacher
);


// ==========================================
// 4. DELETE TIMETABLE
// ==========================================
// Endpoint: DELETE /api/timetable/delete/:id
timeTableRoutes.delete(
    "/delete/:id",
    multiRoleAuth("correspondent", "administrator", "principal"),
    deleteTimeTable
);



export default timeTableRoutes;
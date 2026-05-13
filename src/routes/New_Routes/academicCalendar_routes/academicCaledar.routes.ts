import express from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import { createCalendarEvent, deleteCalendarEvent, getAllCalendarEvents, getSingleCalendarEvent, updateCalendarEvent } from "../../../controllers/New_Controllers/academicCalendar/academicCalendar.controller.js";

const CalendarRoutes = express.Router();

// Create a new event (Admins/Management only)
CalendarRoutes.post(
    "/create",
    multiRoleAuth("correspondent", "administrator",),
    createCalendarEvent
);

// Update an event
CalendarRoutes.put(
    "/update/:id",
    multiRoleAuth("correspondent", "administrator",),
    updateCalendarEvent
);

// Get all events (Accessible by everyone)
CalendarRoutes.get(
    "/getall",
    multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"),
    getAllCalendarEvents
);


// Get Single event details
CalendarRoutes.get(
    "/getsingle/:id",
    multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"),
    getSingleCalendarEvent
);

// Delete an event
CalendarRoutes.delete(
    "/delete/:id",
    multiRoleAuth("correspondent", "administrator",),
    deleteCalendarEvent
);

export default CalendarRoutes;
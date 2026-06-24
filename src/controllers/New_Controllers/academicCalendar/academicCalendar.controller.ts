
// import AcademicCalendarModel from "../../../models/New_Model/academicCalendar_model/academicCalendar.model.s";
import { type Response } from "express";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import AcademicCalendarModel from "../../../models/New_Model/academicCalendar_model/academicCalendar.model.js";

export const createCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
    try {
        let {
            schoolId,
            title,
            description,
            startDate,
            endDate,
            type,
            applicableToClasses,
            academicYear
        } = req.body;


        // 1. STRICTOR VALIDATION: Title is mandatory from the user
        if (!title || title.trim() === "") {
            return res.status(400).json({
                ok: false,
                message: "Event title is required. Please provide a name for this calendar entry."
            });
        }
        if (!academicYear) {
            // // 1. Get Academic Year (Source of Truth)
            const schoolDoc = await SchoolModel.findById(schoolId)
            academicYear = schoolDoc?.currentAcademicYear;

            if (!academicYear) {
                return res.status(500).json({
                    ok: false,
                    message: "Current Academic year is not set for the school , either set in school department or else provide the academic year"
                });
            }
        }


        // 3. Validate remaining fields
        if (!startDate || !endDate) {
            return res.status(400).json({
                ok: false,
                message: "Please provide the startDate, endDate"
            });
        }

        if (new Date(endDate) < new Date(startDate)) {
            return res.status(400).json({
                ok: false,
                message: "endDate cannot be before startDate."
            });
        }


        // ADD this block after the title validation, before the academicYear check
        if (!type || !["holiday", "exam", "event", "special_occasion"].includes(type)) {
            return res.status(400).json({
                ok: false,
                message: "Type must be one of: holiday, exam, event, special_occasion."
            });
        }

        // 4. Duplicate Check (Check if this title exists on this specific start date)
        const existingEvent = await AcademicCalendarModel.findOne({
            schoolId,
            academicYear,
            title: title.trim(),
            startDate: new Date(startDate),
        });

        if (existingEvent) {
            return res.status(400).json({
                ok: false,
                message: `The event '${title}' is already scheduled for this date in the ${academicYear} calendar.`
            });
        }

        // 5. Create the New Event
        const newEvent = new AcademicCalendarModel({
            schoolId,
            title: title.trim(),
            description,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            type,
            academicYear, // Injected from the school document
            applicableToClasses: applicableToClasses || []
        });

        await newEvent.save();

        res.status(201).json({
            ok: true,
            data: newEvent,
            message: `Successfully created '${title}' for the ${academicYear} academic year.`
        });

    } catch (error: any) {
        console.error("Create Calendar Event Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};


export const updateCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        // const  = req.user.schoolId;
        // const updates = req.body;

        // Explicitly destructure only the allowed fields
        const {
            title,
            description,
            startDate,
            endDate,
            type,
            applicableToClasses,
            academicYear
        } = req.body;

        // ADD this right after destructuring, before building updateData
        if (type !== undefined && !["holiday", "exam", "event", "special_occasion"].includes(type)) {
            return res.status(400).json({ ok: false, message: "Invalid event type." });
        }

        // Construct the update object with only defined fields
        const updateData: any = {};
        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description;
        if (startDate !== undefined) updateData.startDate = new Date(startDate);
        if (endDate !== undefined) updateData.endDate = new Date(endDate);
        if (type !== undefined) updateData.type = type;
        if (applicableToClasses !== undefined) updateData.applicableToClasses = applicableToClasses;
        if (academicYear !== undefined) updateData.academicYear = academicYear;

        if (updateData.startDate || updateData.endDate) {
            // Need the existing doc to validate partial updates (only startDate OR only endDate sent)
            const existing = await AcademicCalendarModel.findById(id);
            if (!existing) {
                return res.status(404).json({ ok: false, message: "Event not found." });
            }
            const effectiveStart = updateData.startDate || existing.startDate;
            const effectiveEnd = updateData.endDate || existing.endDate;
            if (effectiveEnd < effectiveStart) {
                return res.status(400).json({ ok: false, message: "endDate cannot be before startDate." });
            }
        }


        const updatedEvent = await AcademicCalendarModel.findOneAndUpdate(
            { _id: id },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedEvent) {
            return res.status(404).json({ ok: false, message: "Event not found or unauthorized." });
        }

        return res.status(200).json({
            ok: true,
            data: updatedEvent,
            message: "Calendar event updated successfully."
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const getAllCalendarEvents = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { month, type, academicYear, schoolId } = req.query;

        let activeYear: any = academicYear;

        // 1. If no academicYear provided in query, fetch the default from SchoolModel
        if (!activeYear) {
            const schoolDoc = await SchoolModel.findById(schoolId).select("currentAcademicYear");
            activeYear = schoolDoc?.currentAcademicYear;
        }

        // ADD this guard
        if (!activeYear) {
            return res.status(400).json({
                ok: false,
                message: "Could not determine academic year. Configure the current academic year in school settings."
            });
        }

        const filter: any = { schoolId, academicYear: activeYear };

        // 2. Filter by Event Type (holiday, exam, etc.)
        if (type) filter.type = type;

        // 3. Filter by Month (1-12)
        // if (month) {
        //     const yearNum = parseInt(activeYear.split('-')[0]); // e.g., "2025" from "2025-2026"
        //     // Note: If month is Jan(1), it might belong to 2026. 
        //     // Simple logic: If month < 6, assume it's the second half of the academic year
        //     const targetYear = parseInt(month as string) < 6 ? yearNum + 1 : yearNum;

        //     const startOfMonth = new Date(targetYear, month - 1, 1);
        //     const endOfMonth = new Date(targetYear, month, 0, 23, 59, 59);

        //     filter.startDate = { $gte: startOfMonth, $lte: endOfMonth };
        // }


        // 3. Filter by Month (1-12)
        if (month) {
            // 1. Convert month to a safe number immediately
            const monthNum = parseInt(month as string, 10);

            // 2. Ensure activeYear exists before splitting to avoid "split of undefined"
            const yearNum = parseInt(activeYear?.split('-')[0]);

            // 3. Logic for Academic Year crossover (Jan-May = Next Year)
            const targetYear = monthNum < 6 ? yearNum + 1 : yearNum;

            // 4. Create Dates using the numeric monthNum
            const startOfMonth = new Date(targetYear, monthNum - 1, 1);
            const endOfMonth = new Date(targetYear, monthNum, 0, 23, 59, 59);

            filter.startDate = { $gte: startOfMonth, $lte: endOfMonth };
        }

        const events = await AcademicCalendarModel.find(filter).sort({ startDate: 1 });

        res.status(200).json({
            ok: true,
            count: events.length,
            data: events,
            message: `Fetched calendar events for ${activeYear}`
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};


export const getSingleCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        // 1. Find the event and ensure it belongs to the user's school
        const event = await AcademicCalendarModel.findOne({
            _id: id,
        }).populate("applicableToClasses", "name schoolId"); // Optional: populate class details

        if (!event) {
            return res.status(404).json({
                ok: false,
                message: "Calendar event not found or you do not have permission to view it."
            });
        }

        res.status(200).json({
            ok: true,
            data: event,
            message: "Event details fetched successfully."
        });
    } catch (error: any) {
        console.error("Get Single Event Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};


export const deleteCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const deletedEvent = await AcademicCalendarModel.findOneAndDelete({
            _id: id,
        });

        if (!deletedEvent) {
            return res.status(404).json({ ok: false, message: "Event not found or unauthorized." });
        }

        res.status(200).json({
            ok: true,
            message: `'${deletedEvent.title}' has been removed from the calendar.`
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};


// SECOND VERSION


// // import AcademicCalendarModel from "../../../models/New_Model/academicCalendar_model/academicCalendar.model.s";
// import type { Response } from "express";
// import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
// import type { RoleBasedRequest } from "../../../utils/types.js";
// import AcademicCalendarModel from "../../../models/New_Model/academicCalendar_model/academicCalendar.model.js";

// export const createCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         let {
//             schoolId,
//             title,
//             description,
//             startDate,
//             endDate,
//             type,
//             applicableToClasses,
//             academicYear
//         } = req.body;


//         // 1. STRICTOR VALIDATION: Title is mandatory from the user
//         if (!title || title.trim() === "") {
//             return res.status(400).json({
//                 ok: false,
//                 message: "Event title is required. Please provide a name for this calendar entry."
//             });
//         }
//         if (!academicYear) {
//             // // 1. Get Academic Year (Source of Truth)
//             const schoolDoc = await SchoolModel.findById(schoolId)
//             academicYear = schoolDoc?.currentAcademicYear;

//             if (!academicYear) {
//                 return res.status(500).json({
//                     ok: false,
//                     message: "Current Academic year is not set for the school , either set in school department or else provide the academic year"
//                 });
//             }
//         }


//         // 3. Validate remaining fields
//         if (!startDate || !endDate || !type) {
//             return res.status(400).json({
//                 ok: false,
//                 message: "Please provide the startDate, endDate, and event type (holiday/exam/event)."
//             });
//         }

//         // 4. Duplicate Check (Check if this title exists on this specific start date)
//         const existingEvent = await AcademicCalendarModel.findOne({
//             schoolId,
//             academicYear,
//             title: title.trim(),
//             startDate: new Date(startDate),
//         });

//         if (existingEvent) {
//             return res.status(400).json({
//                 ok: false,
//                 message: `The event '${title}' is already scheduled for this date in the ${academicYear} calendar.`
//             });
//         }

//         // 5. Create the New Event
//         const newEvent = new AcademicCalendarModel({
//             schoolId,
//             title: title.trim(),
//             description,
//             startDate: new Date(startDate),
//             endDate: new Date(endDate),
//             type,
//             academicYear, // Injected from the school document
//             applicableToClasses: applicableToClasses || []
//         });

//         await newEvent.save();

//         res.status(201).json({
//             ok: true,
//             data: newEvent,
//             message: `Successfully created '${title}' for the ${academicYear} academic year.`
//         });

//     } catch (error: any) {
//         console.error("Create Calendar Event Error:", error);
//         res.status(500).json({ ok: false, message: error.message });
//     }
// };


// export const updateCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const { id } = req.params;
//         // const  = req.user.schoolId;
//         // const updates = req.body;

//         // Explicitly destructure only the allowed fields
//         const {
//             title,
//             description,
//             startDate,
//             endDate,
//             type,
//             applicableToClasses,
//             academicYear
//         } = req.body;


//         // Construct the update object with only defined fields
//         const updateData: any = {};
//         if (title !== undefined) updateData.title = title.trim();
//         if (description !== undefined) updateData.description = description;
//         if (startDate !== undefined) updateData.startDate = new Date(startDate);
//         if (endDate !== undefined) updateData.endDate = new Date(endDate);
//         if (type !== undefined) updateData.type = type;
//         if (applicableToClasses !== undefined) updateData.applicableToClasses = applicableToClasses;
//         if (academicYear !== undefined) updateData.academicYear = academicYear;


//         const updatedEvent = await AcademicCalendarModel.findOneAndUpdate(
//             { _id: id },
//             { $set: updateData },
//             { new: true, runValidators: true }
//         );

//         if (!updatedEvent) {
//             return res.status(404).json({ ok: false, message: "Event not found or unauthorized." });
//         }

//         return res.status(200).json({
//             ok: true,
//             data: updatedEvent,
//             message: "Calendar event updated successfully."
//         });
//     } catch (error: any) {
//         return res.status(500).json({ ok: false, message: error.message });
//     }
// };


// export const getAllCalendarEvents = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const { month, type, academicYear, schoolId } = req.query;

//         let activeYear: any = academicYear;

//         // 1. If no academicYear provided in query, fetch the default from SchoolModel
//         if (!activeYear) {
//             const schoolDoc = await SchoolModel.findById(schoolId).select("currentAcademicYear");
//             activeYear = schoolDoc?.currentAcademicYear;
//         }

//         const filter: any = { schoolId, academicYear: activeYear };

//         // 2. Filter by Event Type (holiday, exam, etc.)
//         if (type) filter.type = type;

//         // 3. Filter by Month (1-12)
//         // if (month) {
//         //     const yearNum = parseInt(activeYear.split('-')[0]); // e.g., "2025" from "2025-2026"
//         //     // Note: If month is Jan(1), it might belong to 2026.
//         //     // Simple logic: If month < 6, assume it's the second half of the academic year
//         //     const targetYear = parseInt(month as string) < 6 ? yearNum + 1 : yearNum;

//         //     const startOfMonth = new Date(targetYear, month - 1, 1);
//         //     const endOfMonth = new Date(targetYear, month, 0, 23, 59, 59);

//         //     filter.startDate = { $gte: startOfMonth, $lte: endOfMonth };
//         // }


//         // 3. Filter by Month (1-12)
//         if (month) {
//             // 1. Convert month to a safe number immediately
//             const monthNum = parseInt(month as string, 10);

//             // 2. Ensure activeYear exists before splitting to avoid "split of undefined"
//             const yearNum = parseInt(activeYear?.split('-')[0]);

//             // 3. Logic for Academic Year crossover (Jan-May = Next Year)
//             const targetYear = monthNum < 6 ? yearNum + 1 : yearNum;

//             // 4. Create Dates using the numeric monthNum
//             const startOfMonth = new Date(targetYear, monthNum - 1, 1);
//             const endOfMonth = new Date(targetYear, monthNum, 0, 23, 59, 59);

//             filter.startDate = { $gte: startOfMonth, $lte: endOfMonth };
//         }

//         const events = await AcademicCalendarModel.find(filter).sort({ startDate: 1 });

//         res.status(200).json({
//             ok: true,
//             count: events.length,
//             data: events,
//             message: `Fetched calendar events for ${activeYear}`
//         });
//     } catch (error: any) {
//         res.status(500).json({ ok: false, message: error.message });
//     }
// };


// export const getSingleCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const { id } = req.params;

//         // 1. Find the event and ensure it belongs to the user's school
//         const event = await AcademicCalendarModel.findOne({
//             _id: id,
//         }).populate("applicableToClasses", "name schoolId"); // Optional: populate class details

//         if (!event) {
//             return res.status(404).json({
//                 ok: false,
//                 message: "Calendar event not found or you do not have permission to view it."
//             });
//         }

//         res.status(200).json({
//             ok: true,
//             data: event,
//             message: "Event details fetched successfully."
//         });
//     } catch (error: any) {
//         console.error("Get Single Event Error:", error);
//         res.status(500).json({ ok: false, message: error.message });
//     }
// };


// export const deleteCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const { id } = req.params;

//         const deletedEvent = await AcademicCalendarModel.findOneAndDelete({
//             _id: id,
//         });

//         if (!deletedEvent) {
//             return res.status(404).json({ ok: false, message: "Event not found or unauthorized." });
//         }

//         res.status(200).json({
//             ok: true,
//             message: `'${deletedEvent.title}' has been removed from the calendar.`
//         });
//     } catch (error: any) {
//         res.status(500).json({ ok: false, message: error.message });
//     }
// };




//  THIRD VERSION

// import { type Request,  type Response } from "express";
// import mongoose from "mongoose";
// import type { RoleBasedRequest } from "../../../utils/types.js";
// import SchoolCalendarModel, { type ICalendarEvent } from "../../../models/New_Model/academicCalendar_model/academicCalendar.model.js";

// // Small helper — keeps controllers free of repeated ObjectId checks
// const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

// /**
//  * GET /api/schools/:schoolId/calendar?academicYear=2026-2027
//  *
//  * Returns the calendar for a given school + academic year.
//  * If no calendar exists yet, returns an empty events array rather than 404 —
//  * this is a deliberate choice: the frontend can render an empty calendar UI
//  * without special-casing "no calendar created yet".
//  */
// export const getSchoolCalendar = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const { schoolId } = req.params;
//         const { academicYear } = req.query;



//         if (!isValidObjectId(schoolId)) {
//             return res.status(400).json({ success: false, message: "Invalid schoolId" });
//         }
//         if (!academicYear || typeof academicYear !== "string") {
//             return res.status(400).json({ success: false, message: "academicYear query param is required" });
//         }

//         const calendar = await SchoolCalendarModel.findOne({ schoolId, academicYear }).lean();

//         if (!calendar) {
//             return res.status(200).json({
//                 success: true,
//                 data: { schoolId, academicYear, events: [] },
//             });
//         }

//         return res.status(200).json({ success: true, data: calendar });
//     } catch (error) {
//         console.error("getSchoolCalendar error:", error);
//         return res.status(500).json({ success: false, message: "Failed to fetch school calendar" });
//     }
// };

// /**
//  * POST /api/schools/:schoolId/calendar/events
//  * Body: { academicYear, title, type, date, endDate?, source?, description? }
//  *
//  * Creates the calendar document for the academic year if it doesn't exist yet
//  * (upsert), then pushes the new event into it. This means the frontend never
//  * has to separately call "create calendar" before "add event" — first event
//  * added for a new academic year just creates the parent doc implicitly.
//  */
// export const addCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const { schoolId } = req.params;
//         const { academicYear, title, type, date, endDate, source, description } = req.body;

//         if (!isValidObjectId(schoolId)) {
//             return res.status(400).json({ success: false, message: "Invalid schoolId" });
//         }
//         if (!academicYear || !title || !type || !date) {
//             return res.status(400).json({
//                 success: false,
//                 message: "academicYear, title, type, and date are required",
//             });
//         }
//         if (!["holiday", "event", "exam"].includes(type)) {
//             return res.status(400).json({ success: false, message: "Invalid event type" });
//         }

//         const parsedDate = new Date(date);
//         if (isNaN(parsedDate.getTime())) {
//             return res.status(400).json({ success: false, message: "Invalid date" });
//         }

//         let parsedEndDate: Date | undefined;
//         if (endDate) {
//             parsedEndDate = new Date(endDate);
//             if (isNaN(parsedEndDate.getTime())) {
//                 return res.status(400).json({ success: false, message: "Invalid endDate" });
//             }
//             if (parsedEndDate < parsedDate) {
//                 return res.status(400).json({ success: false, message: "endDate cannot be before date" });
//             }
//         }

//         const newEvent: Partial<ICalendarEvent> = {
//             title: title.trim(),
//             type,
//             date: parsedDate,
//             ...(parsedEndDate && { endDate: parsedEndDate }),
//             ...(source && { source }),
//             ...(description && { description }),
//         };

//         // upsert: if the calendar for this school+year doesn't exist, create it
//         // with this event already inside, in a single atomic operation.
//         const calendar = await SchoolCalendarModel.findOneAndUpdate(
//             { schoolId, academicYear },
//             { $push: { events: newEvent } },
//             { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
//         );

//         return res.status(201).json({ success: true, data: calendar });
//     } catch (error) {
//         console.error("addCalendarEvent error:", error);
//         return res.status(500).json({ success: false, message: "Failed to add calendar event" });
//     }
// };

// /**
//  * PATCH /api/schools/:schoolId/calendar/events/:eventId
//  * Body: { academicYear, title?, type?, date?, endDate?, source?, description? }
//  *
//  * Updates a single event inside the calendar's events array using the
//  * positional $ operator with arrayFilters. Only fields actually passed
//  * in the body are updated — this is a partial update, not a full replace.
//  */
// export const updateCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const { schoolId, eventId } = req.params;
//         const { academicYear, title, type, date, endDate, source, description } = req.body;

//         if (!isValidObjectId(schoolId) || !isValidObjectId(eventId)) {
//             return res.status(400).json({ success: false, message: "Invalid schoolId or eventId" });
//         }
//         if (!academicYear) {
//             return res.status(400).json({ success: false, message: "academicYear is required" });
//         }
//         if (type && !["holiday", "event", "exam"].includes(type)) {
//             return res.status(400).json({ success: false, message: "Invalid event type" });
//         }

//         // Build the $set object dynamically so untouched fields are left alone.
//         // Mongoose's runValidators on findOneAndUpdate only validates fields
//         // present in this $set, so the cross-field endDate>=date validator
//         // only re-runs if date or endDate is actually being changed.
//         const setFields: Record<string, unknown> = {};

//         if (title !== undefined) setFields["events.$[elem].title"] = title.trim();
//         if (type !== undefined) setFields["events.$[elem].type"] = type;
//         if (source !== undefined) setFields["events.$[elem].source"] = source;
//         if (description !== undefined) setFields["events.$[elem].description"] = description;

//         let parsedDate: Date | undefined;
//         let parsedEndDate: Date | undefined;

//         if (date !== undefined) {
//             parsedDate = new Date(date);
//             if (isNaN(parsedDate.getTime())) {
//                 return res.status(400).json({ success: false, message: "Invalid date" });
//             }
//             setFields["events.$[elem].date"] = parsedDate;
//         }

//         if (endDate !== undefined) {
//             // allow explicitly clearing endDate by passing endDate: null
//             if (endDate === null) {
//                 setFields["events.$[elem].endDate"] = undefined;
//             } else {
//                 parsedEndDate = new Date(endDate);
//                 if (isNaN(parsedEndDate.getTime())) {
//                     return res.status(400).json({ success: false, message: "Invalid endDate" });
//                 }
//                 setFields["events.$[elem].endDate"] = parsedEndDate;
//             }
//         }

//         if (Object.keys(setFields).length === 0) {
//             return res.status(400).json({ success: false, message: "No fields provided to update" });
//         }

//         // If either date or endDate is changing, validate the relationship
//         // ourselves before hitting the DB — we need the *existing* event to
//         // know the other value if only one of date/endDate was passed.
//         if (parsedDate || parsedEndDate) {
//             const existingCalendar = await SchoolCalendarModel.findOne(
//                 { schoolId, academicYear, "events._id": eventId },
//                 { events: { $elemMatch: { _id: eventId } } }
//             ).lean();

//             const existingEvent = existingCalendar?.events?.[0];
//             if (!existingEvent) {
//                 return res.status(404).json({ success: false, message: "Event not found" });
//             }

//             const effectiveDate = parsedDate ?? existingEvent.date;
//             const effectiveEndDate =
//                 endDate === null ? undefined : parsedEndDate ?? existingEvent.endDate;

//             if (effectiveEndDate && effectiveEndDate < effectiveDate) {
//                 return res.status(400).json({ success: false, message: "endDate cannot be before date" });
//             }
//         }

//         const updated = await SchoolCalendarModel.findOneAndUpdate(
//             { schoolId, academicYear, "events._id": eventId },
//             { $set: setFields },
//             {
//                 new: true,
//                 arrayFilters: [{ "elem._id": eventId }],
//                 runValidators: true,
//             }
//         );

//         if (!updated) {
//             return res.status(404).json({ success: false, message: "Calendar or event not found" });
//         }

//         return res.status(200).json({ success: true, data: updated });
//     } catch (error) {
//         console.error("updateCalendarEvent error:", error);
//         return res.status(500).json({ success: false, message: "Failed to update calendar event" });
//     }
// };

// /**
//  * DELETE /api/schools/:schoolId/calendar/events/:eventId
//  * Body: { academicYear }
//  */
// export const deleteCalendarEvent = async (req: RoleBasedRequest, res: Response) => {
//     try {
//         const { schoolId, eventId } = req.params;
//         const { academicYear } = req.body;

//         if (!isValidObjectId(schoolId) || !isValidObjectId(eventId)) {
//             return res.status(400).json({ success: false, message: "Invalid schoolId or eventId" });
//         }
//         if (!academicYear) {
//             return res.status(400).json({ success: false, message: "academicYear is required" });
//         }

//         const updated = await SchoolCalendarModel.findOneAndUpdate(
//             { schoolId, academicYear },
//             { $pull: { events: { _id: eventId } } },
//             { new: true }
//         );

//         if (!updated) {
//             return res.status(404).json({ success: false, message: "Calendar not found" });
//         }

//         return res.status(200).json({ success: true, data: updated });
//     } catch (error) {
//         console.error("deleteCalendarEvent error:", error);
//         return res.status(500).json({ success: false, message: "Failed to delete calendar event" });
//     }
// };
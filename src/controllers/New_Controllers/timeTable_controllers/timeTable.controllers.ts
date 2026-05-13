import mongoose from "mongoose";
import TimeTableModel from "../../../models/New_Model/timeTable_model/timeTable.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";



// ==========================================================
// GET TIMETABLES (Filter by School, Class, or Section)
// ==========================================================
export const getTimeTables = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { schoolId, classId, sectionId, weeklyScheduleId, day } = req.query;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "School ID is required" });
        }


        if(weeklyScheduleId && day){
            return res.status(400).json({ ok: false, message: "you cannot send both weeklyScheduleId and the day together send any one only to get day specific time table" });
        }

        const query:any = { schoolId };
        if (classId) query.classId = classId;
        if (sectionId) query.sectionId = sectionId;


        let results = await TimeTableModel.find(query)
            .populate("classId", "name")
            .populate("sectionId", "name")
            .populate("weeklySchedule.periods.teacherId", "userName _id") // Populate teacher details
            .lean();


            // 2. Apply filtering for the specific Day or ID
        if (results?.length > 0 && (day || weeklyScheduleId)) {
            results = results?.map(doc => {
                const filteredSchedule = doc.weeklySchedule.filter((item:any) => {
                    if (day) {
                        return item.day.toLowerCase() === day.toLowerCase();
                    }
                    if (weeklyScheduleId) {
                        // Check against the _id of the schedule object
                        return item._id.toString() === weeklyScheduleId;
                    }
                    return true;
                });

                return { ...doc, weeklySchedule: filteredSchedule };
            });
        }

        return res.status(200).json({
            ok: true,
            // count: results.length,
            message:"fetched time table successfully",
            data: results
        });
    } catch (error:any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};




// ==========================================================
// ADD DAY (Initializes Table and Day)
// ==========================================================
export const addDay = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { schoolId, classId, sectionId, day } = req.body;

        if (!schoolId || !classId || !day) {
            return res.status(400).json({ ok: false, message: "Missing schoolId, classId, or day" });
        }

        // 1. Find/Create main document and add day if it doesn't exist
        const timetable = await TimeTableModel.findOneAndUpdate(
            { schoolId, classId, sectionId: sectionId || null },
            { $setOnInsert: { weeklySchedule: [] } },
            { upsert: true, new: true }
        );

        const dayExists = timetable.weeklySchedule.some(d => d.day.toLowerCase() === day.toLowerCase());
        
        if (dayExists) {
            return res.status(400).json({ ok: false, message: "Day already exists in timetable" });
        }

        const updated = await TimeTableModel.findByIdAndUpdate(
            timetable._id,
            { $push: { weeklySchedule: { day, periods: [] } } },
            { new: true }
        );

        return res.status(200).json({ ok: true, message: "Day added successfully", data: updated });
    } catch (error:any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// ==========================================================
// UPDATE DAY NAME (e.g., "Monday" -> "Mon")
// ==========================================================
export const updateDayName = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { schoolId, 
            
            // classId, sectionId,
            
            weeklyScheduleId, day } = req.body;

        if (!schoolId || !weeklyScheduleId || !day) {
            return res.status(400).json({ ok: false, message: "Missing required fields: schoolId, weeklyScheduleId, or day" });
        }

        const dayObjectId = new mongoose.Types.ObjectId(weeklyScheduleId);

        const updated = await TimeTableModel.findOneAndUpdate(
            { 
                schoolId, 
                // classId, 
                // sectionId: sectionId || null, 
                "weeklySchedule._id": dayObjectId 
            },
            { 
                $set: { "weeklySchedule.$.day": day } 
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ ok: false, message: "Day record not found to update name." });
        }

        return res.status(200).json({ 
            ok: true, 
            message: "Day name updated successfully", 
            data: updated 
        });

    } catch (error:any) {
        console.error("Update Day Name Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};



// ==========================================================
// DELETE ENTIRE DAY (Removes day and all its periods)
// ==========================================================
export const deleteDay = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { schoolId, classId, sectionId, weeklyScheduleId } = req.body;

        if (!schoolId || !classId || !weeklyScheduleId) {
            return res.status(400).json({ ok: false, message: "Missing schoolId, classId, or weeklyScheduleId" });
        }

        const dayObjectId = new mongoose.Types.ObjectId(weeklyScheduleId);

        // We target the main document and $pull the day object that matches the ID
        const result = await TimeTableModel.findOneAndUpdate(
            { 
                schoolId, 
                classId, 
                sectionId: sectionId || null 
            },
            { 
                $pull: { weeklySchedule: { _id: dayObjectId } } 
            },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ ok: false, message: "Timetable or Day record not found." });
        }

        return res.status(200).json({ 
            ok: true, 
            message: "Day and all associated periods removed successfully", 
            data: result 
        });
    } catch (error:any) {
        console.error("Delete Day Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};


//  PERIOD RELATED
// ==========================================================
// UPSERT PERIOD (Using weeklyScheduleId for absolute accuracy) (Add if new, Update if exists)
// ==========================================================
export const upsertPeriod = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { schoolId, classId, sectionId, weeklyScheduleId, periodData } = req.body;

        if (!schoolId || !classId || !weeklyScheduleId || !periodData.periodNumber) {
            return res.status(400).json({ ok: false, message: "Missing required fields: schoolId, classId, weeklyScheduleId, and periodNumber" });
        }

        // Convert string ID to ObjectId for reliable matching in arrayFilters
        const dayObjectId = new mongoose.Types.ObjectId(weeklyScheduleId);

        const query = { 
            schoolId, 
            classId, 
            sectionId: sectionId || null, 
            "weeklySchedule._id": dayObjectId 
        };

        // 1. Check if the period number already exists for that specific day ID
        const existingDoc = await TimeTableModel.findOne({
            ...query,
            "weeklySchedule": {
                $elemMatch: {
                    "_id": dayObjectId,
                    "periods.periodNumber": periodData.periodNumber
                }
            }
        });

        let updated;
        
        if (existingDoc) {
            // CASE: Update existing period
            updated = await TimeTableModel.findOneAndUpdate(
                query,
                { $set: { "weeklySchedule.$[d].periods.$[p]": periodData } },
                { 
                    arrayFilters: [
                        { "d._id": dayObjectId }, 
                        { "p.periodNumber": periodData.periodNumber }
                    ],
                    new: true 
                }
            ).populate("weeklySchedule.periods.teacherId", "userName _id");

        } else {
            // CASE: Add new period
            updated = await TimeTableModel.findOneAndUpdate(
                query,
                { $push: { "weeklySchedule.$.periods": periodData } },
                { new: true }
            ).populate("weeklySchedule.periods.teacherId", "userName _id");
        }

        if (!updated) {
            return res.status(404).json({ ok: false, message: "Timetable or Day ID not found." });
        }

        return res.status(200).json({ 
            ok: true, 
            message: existingDoc ? "Period updated successfully" : "New period added successfully", 
            data: updated 
        });
    } catch (error:any) {
        console.error("Upsert Period Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// ==========================================================
// DELETE SINGLE PERIOD (Flexible Body-Based)
// ==========================================================
export const deleteSinglePeriod = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { schoolId, classId, sectionId, weeklyScheduleId, periodId } = req.body;

        // Basic Validation
        if (!schoolId || !classId || !weeklyScheduleId || !periodId) {
            return res.status(400).json({ ok: false, message: "Missing required IDs in body." });
        }

        const dayObjectId = new mongoose.Types.ObjectId(weeklyScheduleId);
        const periodObjectId = new mongoose.Types.ObjectId(periodId);

        const result = await TimeTableModel.findOneAndUpdate(
            { 
                schoolId, 
                classId, 
                // Handles case where sectionId is undefined or null automatically
                sectionId: sectionId || null, 
                "weeklySchedule._id": dayObjectId 
            },
            { 
                $pull: { "weeklySchedule.$.periods": { _id: periodObjectId } } 
            },
            { new: true }
        ).populate("weeklySchedule.periods.teacherId", "userName _id");

        if (!result) {
            return res.status(404).json({ ok: false, message: "Record not found." });
        }

        return res.status(200).json({ 
            ok: true, 
            message: "Period deleted successfully", 
            data: result 
        });
    } catch (error:any) {
        console.error("Delete Period Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};







// ==========================================================
// DELETE TIMETABLE
// ==========================================================
export const deleteTimeTable = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { id } = req.params;

        const deleted = await TimeTableModel.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ ok: false, message: "Timetable not found" });
        }

        return res.status(200).json({
            ok: true,
            message: "Timetable deleted successfully",
            data:deleted
        });
    } catch (error:any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// ==========================================================
// GET TEACHER SCHEDULE (Across all classes)
// ==========================================================
export const getTeacherSchedule = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { schoolId, teacherId } = req.query;

        const schedules = await TimeTableModel.find({
            schoolId,
            "weeklySchedule.periods.teacherId": teacherId
        })
        .populate("classId sectionId", "name")
        .lean();



        // Note: You might want to filter the array in JS to only show periods 
        // belonging to this specific teacher before sending to frontend.

        // 2. Transform the data to add 'isYourPeriod' flag
        const formattedData = schedules.map(timetable => {
            const processedWeeklySchedule = timetable.weeklySchedule.map(dayEntry => {
                // Map through periods to add the differentiation flag
                const periodsWithFlag = dayEntry.periods.map(period => ({
                    ...period,
                    // Check if this specific period belongs to the teacher
                    isYourPeriod: period.teacherId?.toString() === teacherId.toString()
                }));

                return {
                    ...dayEntry,
                    periods: periodsWithFlag
                };
            })
            // .filter(dayEntry => 
            //     // Optional: Only keep the day if the teacher has at least one period that day
            //     dayEntry.periods.some(p => p.isYourPeriod)
            // );

            return {
                ...timetable,
                weeklySchedule: processedWeeklySchedule
            };
        });
        
        return res.status(200).json({ 
            ok: true, 
            message: "Time table with isYourPeriod field for highlight",
            data: formattedData });


    } catch (error:any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


// ==========================================================
// UPDATE TEACHER FOR A SPECIFIC PERIOD
// ==========================================================
export const updatePeriodTeacher = async (req:RoleBasedRequest, res:Response) => {
    try {
        const {mode} = req.query  // "add" or "remove"
        const { schoolId, classId, sectionId, weeklyScheduleId, periodNumber, teacherId } = req.body;

        if (!schoolId || !classId || !weeklyScheduleId || !mode || !periodNumber) {
            return res.status(400).json({ ok: false, message: "schoolId, classId, weeklyScheduleId, periodNumber, mode fields are required" });
        }


        // Determine the value to set based on the toggle mode
        const newTeacherValue = mode === "add" ? teacherId : null;

        // If adding, ensure teacherId is actually provided
        if (mode === "add" && !teacherId) {
            return res.status(400).json({ ok: false, message: "Teacher ID is required for 'add' mode" });
        }

        const filter = {
            schoolId,
            classId,
            sectionId: sectionId || null
        };

        const update = {
            // Use arrayFilters to find the specific day and specific period number
            $set: { "weeklySchedule.$[dayFilter].periods.$[periodFilter].teacherId": newTeacherValue }
        };

        const options = {
            arrayFilters: [
                { "dayFilter._id": weeklyScheduleId }, // Find the object in weeklySchedule where day matches
                { "periodFilter.periodNumber": periodNumber } // Find the object in periods where periodNumber matches
            ],
            new: true // Return the updated document
        };

        const updatedTable = await TimeTableModel.findOneAndUpdate(filter, update, options)
            .populate("weeklySchedule.periods.teacherId", "userName _id");

        if (!updatedTable) {
            return res.status(404).json({ ok: false, message: "Timetable not found for this class/section" });
        }

        const actionText = mode === "add" ? "assigned" : "removed";

        return res.status(200).json({
            ok: true,
message: `Teacher ${actionText} successfully for Period ${periodNumber}`,
            data: updatedTable
        });

    } catch (error:any) {
        console.error("Update Teacher Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};




// IF YOU HAVE CREAED THE TIME TBAL WITHTHE ACADMEIC YEAR AND TO CLONE THE TIME TABLE FOR NEXT ACADEMIC YAR YOU CNA USE THE BELOW CONTROLLEER

// ==========================================================
// CLONE TIMETABLE (Copy from old year to new year)
// ==========================================================
// export const cloneTimetable = async (req:RoleBasedRequest, res:Response) => {
//     try {
//         const { schoolId, previousAcademicYear, currentAcademicYear } = req.body;

//         if (!schoolId || !previousAcademicYear || !currentAcademicYear) {
//             return res.status(400).json({ ok: false, message: "Missing required years" });
//         }

//         // 1. Find all timetables for the old year
//         const oldTimetables = await TimeTableModel.find({ schoolId, academicYear: previousAcademicYear });

//         if (oldTimetables.length === 0) {
//             return res.status(404).json({ ok: false, message: "No source timetables found to copy" });
//         }

//         // 2. Prepare new documents by changing the year and removing the old _id
//         const newTimetables = oldTimetables.map(tt => {
//             const obj = tt.toObject();
//             delete obj._id; // Remove ID so Mongo creates a new one
//             delete obj.createdAt;
//             delete obj.updatedAt;
            
//             return {
//                 ...obj,
//                 academicYear: currentAcademicYear // Set the new year
//             };
//         });

//         // 3. Insert all at once (or update if they already exists)
//         // Using insertMany is fastest for bulk operations
//         await TimeTableModel.insertMany(newTimetables);

//         return res.status(200).json({
//             ok: true,
//             message: `Successfully copied ${newTimetables.length} class schedules to ${toYear}`
//         });

//     } catch (error:any) {
//         return res.status(500).json({ ok: false, message: error.message });
//     }
// };
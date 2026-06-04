import mongoose from "mongoose";
import SchoolModel from "../../../models/New_Model/SchoolModel/shoolModel.model.js";
import AttendanceModel from "../../../models/New_Model/attendance_model/attendance.model.js";
import StudentRecordModel from "../../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";


const getMidnightDate = (dateString: string) => {
    if (!dateString) return new Date();

    // Split "2025-12-20" into parts
    const parts: string[] = dateString.split('-'); // ["2025", "12", "20"]

    if (parts.length !== 3) {
        throw new Error("Invalid Date Format. Use YYYY-MM-DD");
    }

    const year = parseInt(parts[0]!);
    const month = parseInt(parts[1]!) - 1; // JS Months are 0-11
    const day = parseInt(parts[2]!);


    // Force UTC Midnight
    return new Date(Date.UTC(year, month, day));
};


// ==========================================================
// GET ATTENDANCE SHEET (Smart Fetch)
// ==========================================================
export const getAttendanceSheet = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, classId, sectionId, date, academicYear } = req.query;

        if (!schoolId || !classId || !date) {
            return res.status(400).json({ ok: false, message: "Missing required params: schoolId, classId, date" });
        }

        const targetDate = getMidnightDate(date);

        // 1. DETERMINE ACADEMIC YEAR
        let targetYear = academicYear;
        if (!targetYear) {
            const s = await SchoolModel.findById(schoolId);
            targetYear = s!.currentAcademicYear;
        }

        // 2. CHECK IF ATTENDANCE EXISTS FOR THIS DATE
        const existingRecord = await AttendanceModel.findOne({
            schoolId,
            academicYear: targetYear,
            classId,
            sectionId: sectionId || null,
            date: targetDate
        });

        if (existingRecord) {
            // === SCENARIO 1: VIEW/EDIT MODE ===
            return res.status(200).json({
                ok: true,
                mode: "EDIT",
                academicYear: targetYear,
                date: targetDate,
                data: existingRecord.records // The saved list (Present/Absent/Late)
            });
        }

        // === SCENARIO 2: CREATE MODE (Fetch Students from Ledger) ===
        const query: any = {
            schoolId,
            academicYear: targetYear,
            classId,
            isActive: true
        };
        if (sectionId) query.sectionId = sectionId;

        const students = await StudentRecordModel.find(query)
            .populate("studentId", "studentName srId _id")
            .sort({ "studentId.studentName": 1 });

        if (students.length === 0) {
            return res.status(200).json({
                ok: true,
                mode: "EMPTY",
                message: "No students found for this class.",
                data: []
            });
        }

        // Initialize empty sheet
        const initializedList = students.map((rec: any) => ({
            studentId: rec.studentId?._id,    // This is the _id from StudentNewModel
            studentName: rec.studentId.studentName,
            rollNumber: rec.rollNumber,
            status: "", // Default status
            remark: ""
        }));

        return res.status(200).json({
            ok: true,
            mode: "CREATE",
            academicYear: targetYear,
            date: targetDate,
            data: initializedList
        });

    } catch (error: any) {
        console.error("Fetch Sheet Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// ==========================================================
// 2. MARK OR UPDATE ATTENDANCE (Upsert Logic)
// ==========================================================
export const markAttendance = async (req: RoleBasedRequest, res: Response) => {

    try {
        const {
            schoolId,
            classId,
            sectionId,
            date,
            records, // Array: [{ studentId, studentName, status: "Present" }]
            academicYear
        } = req.body;

        const targetDate = getMidnightDate(date);

        // // 1. Get Academic Year (Source of Truth)
        // const schoolDoc = await SchoolModel.findById(schoolId).session(session);
        // const currentYear = schoolDoc.currentAcademicYear;

        if (!academicYear) {
            return res.status(500).json({ ok: false, message: "please provide the academicYear" });
        }

        // 2. Find Existing Record
        let attendanceDoc = await AttendanceModel.findOne({
            schoolId,
            classId,
            academicYear,
            sectionId: sectionId || null,
            date: targetDate
        })

        if (attendanceDoc) {
            // =====================================================
            // CASE A: UPDATE (CORRECTION MODE)
            // =====================================================

            // 1. Map old records for easy comparison
            const oldRecordsMap = new Map(attendanceDoc.records.map(r => [r.studentId.toString(), r]));
            const newCorrections: any[] = [];

            // 2. Loop through NEW input to find changes
            // logic: We overwrite the main 'records' list with the new input.
            // But before we do, we check if status changed.

            records.forEach((newRec: any) => {
                const oldRec = oldRecordsMap.get(newRec.studentId.toString());

                // If status changed (e.g., Absent -> Present)
                if (oldRec && oldRec.status !== newRec.status) {
                    newCorrections.push({
                        studentId: newRec.studentId,
                        studentName: newRec.studentName, // Frontend sends this back
                        oldStatus: oldRec.status,
                        newStatus: newRec.status,
                        modifiedAt: new Date()
                    });
                }
            });

            // 3. Update the Main List (Source of Truth)
            attendanceDoc.records = records;

            // 4. Add to History Log
            if (newCorrections.length > 0) {
                attendanceDoc.corrections.push(...newCorrections);
            }

            await attendanceDoc.save();

        } else {
            // =====================================================
            // CASE B: CREATE (FIRST TIME)
            // =====================================================
            attendanceDoc = await AttendanceModel.create({
                schoolId,
                academicYear,
                classId,
                sectionId: sectionId || null,
                date: targetDate,
                takenBy: req.user?._id,
                records: records, // Save the list exactly as sent
                corrections: []
            });
        }

        await createAuditLog(req, {
            action: "create",
            module: "attendance",
            targetId: attendanceDoc._id,
            description: `attendance marked (${attendanceDoc._id})`,
            status: "success"
        });




        return res.status(200).json({
            ok: true,
            message: attendanceDoc.corrections.length > 0 ? "Attendance updated & corrections logged" : "Attendance saved successfully",
            data: attendanceDoc
        });

    } catch (error: any) {

        console.error("Mark Attendance Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const getClassAttendanceHistory = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            schoolId,
            classId,
            sectionId,
            academicYear,
            page = 1,
            limit = 10,
            startDate, // Optional: Filter by date range
            endDate
        } = req.query;

        if (!schoolId || !classId) {
            return res.status(400).json({ ok: false, message: "Missing required params" });
        }

        // 1. Determine Academic Year
        let targetYear = academicYear;
        if (!targetYear) {
            const s = await SchoolModel.findById(schoolId);
            targetYear = s!.currentAcademicYear;
        }

        // 2. Build Query
        const query: any = {
            schoolId,
            classId,
            academicYear: targetYear
        };
        if (sectionId) query.sectionId = sectionId;

        // Date Range Filter (Optional)
        if (startDate && endDate) {
            query.date = {
                $gte: getMidnightDate(startDate),
                $lte: getMidnightDate(endDate)
            };
        }

        // 3. Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // 4. Fetch Data (Optimized)
        // We fetch the full doc but we will process it before sending to reduce bandwidth
        const historyDocs = await AttendanceModel.find(query)
            .populate("takenBy", "userName role") // Who took it?
            .sort({ date: -1 }) // Newest first
            .skip(skip)
            .limit(limitNum)
            .lean(); // Faster reading

        // 5. Total Count for Pagination
        const totalDocs = await AttendanceModel.countDocuments(query);

        return res.status(200).json({
            ok: true,
            pagination: {
                totalItems: totalDocs,
                totalPages: Math.ceil(totalDocs / limitNum),
                currentPage: pageNum,
                pageSize: limitNum
            },
            data: historyDocs
        });

    } catch (error: any) {
        console.error("History Error:", error);
        return res.status(500).json({ ok: false, message: error.message });
    }
};





export const getStudentAttendanceHistory = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { studentId } = req.params;
        const { month, year, academicYear } = req.query; // Expects month=10, year=2024

        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ ok: false, message: "Invalid Student ID" });
        }

        // 1. Build the Date Filter
        let dateFilter = {};

        if (month && year) {
            // *** CHANGE: USE Date.UTC TO MATCH YOUR STORAGE LOGIC ***

            // Start: 1st day of month at 00:00:00 UTC
            const startDate = new Date(Date.UTC(year, Number(month) - 1, 1));

            // End: Last day of month at 23:59:59.999 UTC
            // (Day 0 of next month gives the last day of current month)
            const endDate = new Date(Date.UTC(year, Number(month), 0, 23, 59, 59, 999));

            dateFilter = {
                date: { $gte: startDate, $lte: endDate }
            };
        }



        // 2. The Query
        let query: any = {
            ...dateFilter,
            "records.studentId": studentId,

        };

        if (academicYear) {
            query.academicYear = academicYear
        }

        // 3. Fetch Data
        // records.$ matches ONLY the array element for this specific student
        const attendanceList = await AttendanceModel.find(query)
            .select("date records.$")
            .sort({ date: 1 });

        // 4. Format Data for Parent App
        const formattedData = attendanceList.map(doc => {
            // Since we used records.$, the array will strictly have length 1
            const record: any = doc.records[0];

            return {
                attendanceId: doc._id,
                date: doc.date, // Returns ISO String (e.g., 2024-10-01T00:00:00.000Z)
                status: record.status,
                remark: record.remark || null
            };
        });

        // 5. Calculate Summary
        const summary: any = {
            totalDays: formattedData.length,
            present: formattedData.filter(d => d.status.toLowerCase() === 'present').length,
            absent: formattedData.filter(d => d.status.toLowerCase() === 'absent').length,
            late: formattedData.filter(d => d.status.toLowerCase() === 'late').length,
            halfDay: formattedData.filter(d => d.status.toLowerCase() === 'half-day').length,
        };

        // Adding Percentages AFTER the summary object is created
        // Note: We use summary.totalDays instead of totalDays
        summary.presentPercentage = summary.totalDays > 0
            ? parseFloat(((summary.present / summary.totalDays) * 100).toFixed(2))
            : 0;

        summary.absentPercentage = summary.totalDays > 0
            ? parseFloat(((summary.absent / summary.totalDays) * 100).toFixed(2))
            : 0;

        return res.status(200).json({
            ok: true,
            data: formattedData,
            summary: summary
        });

    } catch (error: any) {
        console.error("Get Student Attendance Error:", error);
        return res.status(500).json({ ok: false, message: "Internal server error", error: error?.message });
    }
};



// REPORT 

// Define a clear interface for your mapping
interface AttendanceKpi {
    present: number;
    absent: number;
    late: number;
    "half-day": number;
}

export const getClassAttendanceReport = async (req: RoleBasedRequest, res: Response) => {
    try {
        let { schoolId, academicYear, classId, sectionId, startDate, endDate } = req.query;

        // 1. Input Validation
        if (!schoolId || !classId || !startDate || !endDate) {
            return res.status(400).json({
                ok: false,
                message: "schoolId, classId, startDate, and endDate are required."
            });
        }

        // 1. DETERMINE ACADEMIC YEAR
        if (!academicYear) {
            const s = await SchoolModel.findById(schoolId);
            academicYear = s!.currentAcademicYear;
        }


        if (!academicYear) {
            return res.status(400).json({
                ok: false,
                message: "academic Year is required or set in the school configuration."
            });
        }


        // 2. Build the Match Stage
        const matchStage: any = {
            schoolId: new mongoose.Types.ObjectId(schoolId as string),
            academicYear: academicYear as string,
            classId: new mongoose.Types.ObjectId(classId as string),
            date: {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string)
            }
        };

        // Conditionally add sectionId if provided (allows viewing whole class OR specific section)
        if (sectionId) {
            matchStage.sectionId = new mongoose.Types.ObjectId(sectionId as string);
        }

        // 3. The Power of $facet: Multiple Reports in One Query
        const reportData = await AttendanceModel.aggregate([
            // Step A: Filter down to the specific class and date range
            { $match: matchStage },

            // Step B: Unwind the records array so each student's status becomes a top-level document
            { $unwind: "$records" },

            // Step C: Run parallel aggregations
            {
                $facet: {
                    // --- PIPELINE 1: Overall KPIs (For Dashboard Top Cards & Donut Chart) ---
                    kpiSummary: [
                        {
                            $group: {
                                _id: "$records.status",
                                count: { $sum: 1 }
                            }
                        }
                    ],

                    // --- PIPELINE 2: Timeline Data (For Bar/Line Charts) ---
                    timeline: [
                        {
                            $group: {
                                _id: {
                                    date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                                    status: "$records.status"
                                },
                                count: { $sum: 1 }
                            }
                        },
                        {
                            // Group again by date to format it beautifully for frontend charts
                            $group: {
                                _id: "$_id.date",
                                statuses: {
                                    $push: { k: "$_id.status", v: "$count" }
                                }
                            }
                        },
                        {
                            $project: {
                                date: "$_id",
                                data: { $arrayToObject: "$statuses" },
                                _id: 0
                            }
                        },
                        { $sort: { date: 1 } } // Chronological order
                    ],

                    // --- PIPELINE 3: ADVANCED - At-Risk Students (Chronic Absentees) ---
                    chronicAbsentees: [
                        { $match: { "records.status": "absent" } },
                        {
                            $group: {
                                _id: "$records.studentId",
                                // studentName: { $first: "$records.studentName" },
                                // rollNumber: { $first: "$records.rollNumber" },

                                // 🌟 FIX: Changed $first to $max. This completely ignores the old 'null' records!
                                studentName: { $max: "$records.studentName" },
                                rollNumber: { $max: "$records.rollNumber" },
                                totalAbsences: { $sum: 1 }
                            }
                        },
                        { $sort: { totalAbsences: -1 } },
                        { $limit: 5 } // Top 5 students who need attention
                    ]
                }
            }
        ]);

        // 4. Data Transformation & Percentage Calculation (Post-Processing)
        const result = reportData[0];

        // Calculate percentages safely in Node.js to keep DB load light
        let totalRecords = 0;
        // const kpiMap: Record<string, number> = { present: 0, absent: 0, late: 0, "half-day": 0 };
        const kpiMap: AttendanceKpi = { present: 0, absent: 0, late: 0, "half-day": 0 };

        result.kpiSummary.forEach((kpi: any) => {
            // Check if the ID from Mongo exists in our predefined map keys
            if (kpi._id in kpiMap) {
                kpiMap[kpi._id as keyof AttendanceKpi] = kpi.count;
            }
            totalRecords += kpi.count;
        });



        // EG: SCENARIO FOR THIS 

        // 3. Real-World Example

        // Imagine a class of 10 students over a 2 - day period (20  total records).

        // 15 times students were present the whole day.
        // 4 times students took a half-day.
        // 1 time a student was entirely absent.

        // Standard Calculation:If half-days are counted as present:

        // Rate = (15 + 4)/20 * 100 =95.00%

        // This Formula's Calculation
        // Effective Present Count = 15 + (4 * 0.5) = 17

        // $$$$\text{Effective Attendance Rate} = 17/20 * 100 = 85.00%

        // Advanced Metric: Effective Attendance Rate (Half-day counts as 0.5)
        const effectivePresentCount = kpiMap.present + (kpiMap["half-day"] * 0.5);
        const effectiveAttendanceRate = totalRecords > 0
            ? ((effectivePresentCount / totalRecords) * 100).toFixed(2)
            : 0;

        const finalReport = {
            overview: {
                totalWorkingDays: result.timeline.length,
                totalStudentRecordsEvaluated: totalRecords,
                effectiveAttendanceRate: `${effectiveAttendanceRate}%`,
                distribution: {
                    present: kpiMap.present,
                    absent: kpiMap.absent,
                    late: kpiMap.late,
                    halfDay: kpiMap["half-day"]
                },
                percentages: {
                    present: totalRecords > 0 ? ((kpiMap.present / totalRecords) * 100).toFixed(1) + "%" : "0%",
                    absent: totalRecords > 0 ? ((kpiMap.absent / totalRecords) * 100).toFixed(1) + "%" : "0%",
                }
            },
            chartData: result.timeline,
            atRiskStudents: result.chronicAbsentees
        };

        res.status(200).json({
            ok: true,
            message: "Attendance report generated successfully",
            data: finalReport
        });

    } catch (error: any) {
        console.error("Attendance Report Aggregation Error:", error);
        res.status(500).json({ ok: false, message: "Failed to generate report", error: error.message });
    }
};


export const getAcademicYearLeaderboards = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, academicYear, classId, sectionId } = req.query;

        // 1. Core Validation
        if (!schoolId || !academicYear) {
            return res.status(400).json({
                ok: false,
                message: "schoolId and academicYear are strictly required for yearly leaderboards."
            });
        }

        // 2. Dynamic Match Stage (The Context Switcher)
        const matchStage: any = {
            schoolId: new mongoose.Types.ObjectId(schoolId as string),
            academicYear: academicYear as string,
        };

        if (classId) matchStage.classId = new mongoose.Types.ObjectId(classId as string);
        if (sectionId) matchStage.sectionId = new mongoose.Types.ObjectId(sectionId as string);

        // 3. The Aggregation Pipeline
        const reportData = await AttendanceModel.aggregate([
            // Step A: Filter down to the target context
            { $match: matchStage },

            // Step B: Flatten the data so we can evaluate individual students
            { $unwind: "$records" },

            // Step C: Group all historical records by individual student
            {
                $group: {
                    _id: "$records.studentId",
                    studentName: { $max: "$records.studentName" },
                    rollNumber: { $max: "$records.rollNumber" },
                    classId: { $first: "$classId" },
                    sectionId: { $first: "$sectionId" },
                    
                    presentCount: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } },
                    absentCount: { $sum: { $cond: [{ $eq: ["$records.status", "absent"] }, 1, 0] } },
                    lateCount: { $sum: { $cond: [{ $eq: ["$records.status", "late"] }, 1, 0] } },
                    halfDayCount: { $sum: { $cond: [{ $eq: ["$records.status", "half-day"] }, 1, 0] } },
                    totalDaysEvaluated: { $sum: 1 } 
                }
            },

            // 🌟 NEW: Step C.1 - Lookup the Class Name
            {
                $lookup: {
                    from: "classmodels", // IMPORTANT: Check your MongoDB compass. If your collection is named differently (e.g. 'classes'), change this string.
                    localField: "classId",
                    foreignField: "_id",
                    as: "classData"
                }
            },

            // 🌟 NEW: Step C.2 - Lookup the Section Name
            {
                $lookup: {
                    from: "sectionmodels", // IMPORTANT: Verify this collection name in your DB too.
                    localField: "sectionId",
                    foreignField: "_id",
                    as: "sectionData"
                }
            },

            // 🌟 NEW: Step C.3 - Extract the 'name' string from the lookup arrays
            {
                $addFields: {
                    className: { $arrayElemAt: ["$classData.name", 0] },
                    sectionName: { $arrayElemAt: ["$sectionData.name", 0] }
                }
            },

            // Step D: Calculate the "Effective Attendance" metric
            {
                $addFields: {
                    effectivePresent: { 
                        $add: [
                            "$presentCount", 
                            { $multiply: ["$halfDayCount", 0.5] } 
                        ] 
                    }
                }
            },

            // Step E: Calculate Percentage safely
            {
                $addFields: {
                    attendancePercentage: {
                        $cond: [
                            { $gt: ["$totalDaysEvaluated", 0] },
                            { $multiply: [{ $divide: ["$effectivePresent", "$totalDaysEvaluated"] }, 100] },
                            0
                        ]
                    }
                }
            },

            // Step F: Round the percentage to 2 decimal places natively in MongoDB
            {
                $addFields: {
                    attendancePercentage: { $round: ["$attendancePercentage", 2] }
                }
            },

            // Step G: Clean up the payload before sorting (Removes the bulky lookup arrays)
            {
                $project: {
                    classData: 0,
                    sectionData: 0
                }
            },

            // Step H: The Facet Stage - Spawn 4 parallel pipelines to rank the students
            {
                $facet: {
                    topAttendance: [
                        { $sort: { attendancePercentage: -1, totalDaysEvaluated: -1 } },
                        { $limit: 10 }
                    ],
                    lowestAttendance: [
                        { $match: { totalDaysEvaluated: { $gt: 0 } } },
                        { $sort: { attendancePercentage: 1, absentCount: -1 } },
                        { $limit: 10 }
                    ],
                    mostLate: [
                        { $match: { lateCount: { $gt: 0 } } }, 
                        { $sort: { lateCount: -1, attendancePercentage: 1 } },
                        { $limit: 10 }
                    ],
                    mostHalfDays: [
                        { $match: { halfDayCount: { $gt: 0 } } }, 
                        { $sort: { halfDayCount: -1 } },
                        { $limit: 10 }
                    ]
                }
            }
        ]);

        res.status(200).json({
            ok: true,
            message: "Yearly leaderboards generated successfully",
            data: reportData[0]
        });

    } catch (error: any) {
        console.error("Yearly Attendance Leaderboard Error:", error);
        res.status(500).json({ 
            ok: false, 
            message: "Failed to generate leaderboards", 
            error: error.message 
        });
    }
};
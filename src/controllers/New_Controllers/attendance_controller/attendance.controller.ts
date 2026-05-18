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
            query.academicYear= academicYear
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
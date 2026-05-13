import mongoose, { Schema, Document, Types, model } from "mongoose";

// 1. Individual Period Interface
export interface IPeriod {
    _id?: Types.ObjectId;
    periodNumber: number;
    startTime?: string | null;
    endTime?: string | null;
    subjectName?: string | null;
    teacherId?: Types.ObjectId | null;
    isBreak: boolean;
    roomNumber?: string;
}

// 2. Schedule for a Single Day
export interface IDaySchedule {
    _id?: Types.ObjectId;
    day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
    periods: IPeriod[];
}

// 3. Main Timetable Document Interface
export interface ITimeTable extends Document {
    schoolId: Types.ObjectId;
    academicYear?: string;
    classId: Types.ObjectId;
    sectionId: Types.ObjectId | null;
    weeklySchedule: IDaySchedule[];
    createdAt: Date;
    updatedAt: Date;
}


const timetableSchema = new Schema<ITimeTable>(
    {
        schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", },
        academicYear: { type: String, }, // e.g., "2025-2026"

        // The Target
        classId: { type: Schema.Types.ObjectId, ref: "ClassModel", },
        sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel", default: null },

        // The Schedule Data
        // We store an array of days, and each day contains an array of periods
        weeklySchedule: [
            {
                day: {
                    type: String,
                    //   enum: ["monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                },
                periods: [
                    {
                        periodNumber: { type: Number, required: true }, // 1, 2, 3...
                        startTime: { type: String, default: null }, // e.g., "09:00 AM"
                        endTime: { type: String, default: null },   // e.g., "09:45 AM"
                        subjectName: { type: String, default: null },
                        teacherId: { type: Schema.Types.ObjectId, ref: "UserModel", default: null },
                        isBreak: { type: Boolean, default: false }, // For Lunch/Recess
                        roomNumber: { type: String }
                    }
                ]
            }
        ]
    },
    { timestamps: true }
);

// Indexing for fast lookups
timetableSchema.index({ schoolId: 1});

const TimeTableModel = model("TimeTableModel", timetableSchema);
export default TimeTableModel;
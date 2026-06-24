import mongoose, { Schema, Document, Types }from "mongoose";

export interface IAcademicCalendar extends Document {
    schoolId: Types.ObjectId;
    academicYear: string;
    title: string;
    description?: string | null;
    startDate: Date;
    endDate: Date;
    type: string; // e.g., "holiday", "exam", "event"
    applicableToClasses: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}


const academicCalendarSchema = new mongoose.Schema<IAcademicCalendar>(
    {
        schoolId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "SchoolModel", 
            required: true 
        },
        academicYear: { 
            type: String, // e.g., "2025-2026" 
        },
        title: { type: String, }, // e.g., "Diwali", "Mid-Term Exam"
        description: { type: String, default: null },
        
        startDate: { type: Date,  },
        endDate: { type: Date, }, // For single day events, startDate = endDate
        
        type: { 
            type: String, 
            // enum: ["holiday", "exam", "event", "special_occasion"], 
            // required: true 
        },
                
        // Optional: Target specific classes (e.g., only Grade 10 has an exam)
        applicableToClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: "ClassModel" }] 
    },
    { timestamps: true }
);

// Index for fast lookups by school and year
academicCalendarSchema.index({ schoolId: 1, academicYear: 1, });

const AcademicCalendarModel = mongoose.model("AcademicCalendarModel", academicCalendarSchema);
export default AcademicCalendarModel;






//  SECOND VERSION


// import mongoose, { Schema, Document, Types } from "mongoose";

// // --- Sub-schema for the individual calendar entries ---
// export interface ICalendarEvent {
//     _id?: Types.ObjectId;
//     title: string;                          // e.g., "Diwali", "Annual Sports Day", "Mid-Term Exams"
//     type: "holiday" | "event" | "exam";
//     date: Date;                             // Start date (or the only date, for single-day entries)
//     endDate?: Date;                         // Optional — only set for multi-day spans (exams, multi-day events)
//     source?: "school" | "government";       // Who added/mandated this entry
//     description?: string;
// }

// const CalendarEventSchema = new Schema<ICalendarEvent>({
//     title: { type: String, required: true, trim: true },
//     type: { type: String, enum: ["holiday", "event", "exam"], required: true },

//     date: { type: Date, required: true },
//     endDate: {
//         type: Date,
//         validate: {
//             validator: function (this: ICalendarEvent, value: Date) {
//                 // endDate, if present, must not be before date
//                 if (!value) return true;
//                 return value >= this.date;
//             },
//             message: "endDate cannot be before date",
//         },
//     },

//     source: { type: String, enum: ["school", "government"], default: "school" },
//     description: { type: String, default: "" },
// }, { _id: true, timestamps: true });


// // --- Main Schema for the Academic Year ---
// export interface ISchoolCalendar extends Document {
//     schoolId: Types.ObjectId;
//     academicYear: string;
//     events: ICalendarEvent[];
//     createdAt: Date;
//     updatedAt: Date;
// }

// const SchoolCalendarSchema = new Schema<ISchoolCalendar>({
//     schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
//     academicYear: { type: String, required: true }, // e.g., "2026-2027"

//     events: { type: [CalendarEventSchema], default: [] },

// }, { timestamps: true });

// // One calendar document per school per academic year
// SchoolCalendarSchema.index({ schoolId: 1, academicYear: 1 });

// const SchoolCalendarModel =
//     (mongoose.models.SchoolCalendarModel as mongoose.Model<ISchoolCalendar>) ||
//     mongoose.model<ISchoolCalendar>("SchoolCalendarModel", SchoolCalendarSchema);

// export default SchoolCalendarModel;
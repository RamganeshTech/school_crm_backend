import mongoose, { model } from "mongoose";

import { Types } from "mongoose";

export interface IMarkReportExam {
  examName: string;
  maxMarks?: number;
  passingMarks?: number;
  order?: number | null;
}

export interface IMarkReportSubject {
  subjectName: string;
  subjectCode?: string;
  order?: number | null;
}

export interface IMarkReportConfig {
  _id?: Types.ObjectId;

  schoolId: Types.ObjectId;
  academicYear: string;
  classId: Types.ObjectId;

  // Columns
  exams: IMarkReportExam[];

  // Rows
  subjects: IMarkReportSubject[];

  createdAt?: Date;
  updatedAt?: Date;
}

const markReportConfigSchema = new mongoose.Schema<IMarkReportConfig>({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolModel', required: true },
    academicYear: { type: String, required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassModel', required: true },
    
    // THE COLUMNS in your UI
    exams: [{
        examName: { type: String, required: true }, // e.g., "1st Mid Term"
        maxMarks: { type: Number, default: 100 },
        passingMarks: { type: Number, default: 35 },
        order : {type: Number, default: null}
    }],

    // THE ROWS in your UI
    subjects: [{
        subjectName: { type: String, required: true }, // e.g., "English"
        subjectCode: { type: String } ,// e.g., "ENG-101"
        order : {type: Number, default: null}

    }]
}, { timestamps: true });


markReportConfigSchema.index({ schoolId: 1, academicYear: 1, classId: 1,  });

const MarkReportConfigModel = model("MarkReportConfigModel", markReportConfigSchema);

export default MarkReportConfigModel;
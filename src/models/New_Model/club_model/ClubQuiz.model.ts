


import mongoose, { Schema, Document, Types, model } from "mongoose";

// 1. Individual Question Interface
export interface IQuizQuestion {
    _id?: Types.ObjectId; // Because _id: true is set in sub-schema
    questionText: string;
    options: string[];
    correctOptionIndex: number;
    points: number;
}

// 2. Main Club Quiz Interface
export interface IClubQuiz extends Document {
    schoolId: Types.ObjectId;
    clubId: Types.ObjectId;
    academicYear: string | null;
    clubVideoId: Types.ObjectId | null;
    classId: Types.ObjectId | null;
    sectionId: Types.ObjectId | null;
    title: string;
    description?: string;
    questions: IQuizQuestion[];
    totalPoints: number;
    isGeneratedByAi: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}


const questions = new Schema<IQuizQuestion>({
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctOptionIndex: { type: Number, required: true }, // 0, 1, 2, or 3
    points: { type: Number, default: 1 }
}, { _id: true })

const ClubQuizSchema = new Schema<IClubQuiz>({
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    clubId: { type: Schema.Types.ObjectId, ref: 'ClubMainModel', required:true},
    academicYear:{type:String, default: null},
    clubVideoId: { type: Schema.Types.ObjectId, ref: "ClubVideoModel", default: null },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", default: null },
    sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel", default: null },
    title: { type: String, required: true },
    description: { type: String },
    questions: { type: [questions], default: [] },
    totalPoints: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isGeneratedByAi: {type:Boolean, default:false}
}, { timestamps: true });

const ClubQuizModel = model('ClubQuizModel', ClubQuizSchema);
export default ClubQuizModel;
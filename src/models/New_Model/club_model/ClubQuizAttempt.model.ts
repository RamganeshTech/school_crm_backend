import mongoose, { Schema, Document, Types, model } from "mongoose";

// 1. Snapshot of the Answer (Stores the state of the question at the time of attempt)
export interface IQuizAttemptAnswer {
    _id?: Types.ObjectId;
    questionText: string;
    options: string[];
    selectedOptionIndex: number; // The index the student chose
    correctOptionIndex: number; // The actual correct index
    points: number; // Points awarded for this specific answer
}

// 2. Main Quiz Attempt Interface
export interface IClubQuizAttempt extends Document {
    quizId: Types.ObjectId;
    studentId: Types.ObjectId;
    schoolId: Types.ObjectId;
    academicYear: string | null;
    classId: Types.ObjectId | null;
    sectionId: Types.ObjectId | null;
    answers: IQuizAttemptAnswer[];
    score: number;
    percentage?: number;
    completedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}


const answers = new Schema<IQuizAttemptAnswer>({
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctOptionIndex: { type: Number, required: true }, // 0, 1, 2, or 3
    points: { type: Number, default: 1 }
}, { _id: true })



const attemptSchema = new Schema<IClubQuizAttempt>({
    quizId: { type: Schema.Types.ObjectId, ref: 'ClubQuizModel', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentNewModel', required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    // Denormalized for fast leaderboards:
    academicYear: {type:String, default: null},
    classId: { type: Schema.Types.ObjectId, ref: 'ClassModel', default: null },
    sectionId: { type: Schema.Types.ObjectId, ref: 'SectionModel', default: null },
    answers: { type: [answers], default: [] },
    score: { type: Number, required: true },
    percentage: { type: Number }, // score / totalPoints * 100
    completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const ClubQuizAttemptModel = model('ClubQuizAttemptModel', attemptSchema);

export default ClubQuizAttemptModel
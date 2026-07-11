import type { Response } from "express";
import ClubQuizModel from "../../../models/New_Model/club_model/ClubQuiz.model.js";
import ClubQuizAttemptModel from "../../../models/New_Model/club_model/ClubQuizAttempt.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";

// CREATE: Submit Quiz Attempt (with Auto-Grading)
export const createQuizAttempt = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { quizId, studentAnswers, classId, sectionId, academicYear } = req.body;
        const studentId = req.user?._id;
        const schoolId = req.user?.schoolId;

        // 1. Fetch the original quiz to grade against
        const quiz = await ClubQuizModel.findById(quizId);
        if (!quiz) return res.status(404).json({ ok: false, message: "Quiz not found" });

        // 2. Auto-Grading Logic
        let totalScore = 0;
        const gradedAnswers: any[] = [];


        // Add this right after fetching the 'quiz'
        if (studentAnswers.length !== quiz.questions.length) {
            return res.status(400).json({
                ok: false,
                message: `Validation Failed: This quiz has ${quiz.questions.length} questions, but you sent ${studentAnswers.length} answers.`
            });
        }

        // We map through the quiz questions to ensure we grade correctly
        quiz.questions.forEach((question: any, index: number) => {
            // Find what the student answered for this specific question ID or Index
            const studentAns = studentAnswers.find((a: any) => a.questionId === question?._id.toString() || a.index === index);

            // Double check that the specific answer exists (extra safety)
            if (!studentAns) {
                throw new Error(`Missing answer for question at index ${index}`);
            }

            const isCorrect = studentAns && Number(studentAns.selectedOptionIndex) === question.correctOptionIndex;

            if (isCorrect) totalScore += (question.points || 1);

            gradedAnswers.push({
                questionText: question.questionText,
                options: question.options,
                correctOptionIndex: question.correctOptionIndex,
                points: question.points,
                selectedOptionIndex: studentAns ? studentAns.selectedOptionIndex : null,
                isCorrect: isCorrect
            });
        });

        const percentage = (totalScore / quiz.totalPoints) * 100;

        // 3. Save the Attempt
        const newAttempt = new ClubQuizAttemptModel({
            quizId,
            studentId,
            schoolId,
            classId,
            sectionId,
            academicYear: academicYear || quiz.academicYear,
            answers: gradedAnswers,
            score: totalScore,
            percentage: percentage.toFixed(2),
            completedAt: new Date()
        });

        await newAttempt.save();

        res.status(201).json({
            ok: true,
            message: "Quiz submitted successfully",
            score: totalScore,
            percentage: percentage.toFixed(2),
            data: newAttempt
        });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};

// GET ALL: For Leaderboards & Teacher Review
export const getAllAttempts = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { quizId, classId, sectionId, studentId, page = 1, limit = 10 } = req.query;
        const schoolId = req?.query?.schoolId ||  req.user?.schoolId;

        const filter: any = { schoolId };
        if (quizId) filter.quizId = quizId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (studentId) filter.studentId = studentId;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const attempts = await ClubQuizAttemptModel.find(filter)
            .sort({ score: -1, createdAt: 1 }) // Highest score first
            .skip(skip)
            .limit(parseInt(limit))
            .populate("studentId", "studentName _id")
            .populate("quizId", "title");

        const total = await ClubQuizAttemptModel.countDocuments(filter);

        res.status(200).json({
            ok: true,
            data: attempts,
            total
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};

// GET SINGLE: Review specific student result
export const getSingleAttempt = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const attempt = await ClubQuizAttemptModel.findById(id)
            // .populate("studentId", "name")
            .populate("studentId", "studentName _id")
            .populate("quizId", "title");

        if (!attempt) return res.status(404).json({ ok: false, message: "Attempt not found" });

        res.status(200).json({ ok: true, data: attempt });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};

// DELETE: Cleanup (Admin only)
export const deleteAttempt = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const deletedQuiz = await ClubQuizAttemptModel.findByIdAndDelete(id);
        if (!deletedQuiz) {
            return res.status(404).json({ ok: false, message: "Attempted data not found" });
        }

        res.status(200).json({ ok: true, message: "Attempt deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};
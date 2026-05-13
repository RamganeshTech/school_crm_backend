import ClubQuizModel from "../../../models/New_Model/club_model/ClubQuiz.model.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/shoolModel.model.js";
// import genAI from "../../../Config/geminiConfig.js";
import { ClubVideoModel } from "../../../models/New_Model/club_model/club.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";
import genAI from "../../../config/geminiConfig.js";

export const createClubQuiz = async (req: RoleBasedRequest, res: Response) => {
    try {
        let {
            clubId,
            clubVideoId,
            classId,
            sectionId,
            title,
            description,
            questions,
            academicYear

        } = req.body;

        const schoolId = req.body.schoolId || req.user?.schoolId;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "SchoolId is required." });
        }

        if (!clubId) {
            return res.status(400).json({ ok: false, message: "clubId is required." });
        }

        // 1. Basic Validation
        if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ ok: false, message: "Title and at least one question are required." });
        }




        // 2. Academic Year Fallback
        if (!academicYear) {
            const school = await SchoolModel.findById(schoolId);
            academicYear = school?.currentAcademicYear;
            if (!academicYear) {
                return res.status(400).json({ ok: false, message: "Academic year not provided and not set in school settings." });
            }
        }

        // 3. Senior Dev Logic: Calculate Total Points and validate question structure
        let calculatedTotalPoints = 0;
        for (const q of questions) {
            if (!q.questionText || !q.options || q.options.length < 2) {
                return res.status(400).json({ ok: false, message: "Each question must have text and at least 2 options." });
            }
            calculatedTotalPoints += (Number(q.points) || 1);
        }

        const newQuiz = new ClubQuizModel({
            schoolId,
            clubId,
            clubVideoId,
            classId,
            sectionId,
            title,
            description,
            questions,
            totalPoints: calculatedTotalPoints,
            academicYear,
            isActive: true
        });

        await newQuiz.save();

        res.status(201).json({
            ok: true,
            message: "Club Quiz created successfully",
            data: newQuiz
        });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};

export const updateClubQuiz = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const schoolId = req.user?.schoolId;

        if (!id) {
            return res.status(400).json({ ok: false, message: "id is required." });
        }

        // 1. Create an empty object for the update
        let updateData: any = {};

        // 2. Only add fields to updateData if they exist in req.body
        // Use a whitelist approach for security
        const allowedFields = [
            'clubId', 'clubVideoId', 'classId', 'sectionId',
            'title', 'description', 'academicYear', 'isActive'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        // 3. Special handling for Questions (Recalculate points)
        if (req.body.questions && Array.isArray(req.body.questions)) {
            if (req.body.questions.length === 0) {
                return res.status(400).json({ ok: false, message: "Quiz must have questions." });
            }

            let calculatedTotalPoints = 0;
            for (const q of req.body.questions) {
                if (!q.questionText || !q.options || q.options.length < 2) {
                    return res.status(400).json({ ok: false, message: "Invalid question structure." });
                }
                calculatedTotalPoints += (Number(q.points) || 1);
            }
            updateData.questions = req.body.questions;
            updateData.totalPoints = calculatedTotalPoints;
        }

        // 4. Perform the update with $set
        const updatedQuiz = await ClubQuizModel.findOneAndUpdate(
            { _id: id, schoolId: schoolId },
            { $set: updateData }, // Mongoose only updates the keys in updateData
            { new: true, runValidators: true }
        );

        if (!updatedQuiz) {
            return res.status(404).json({ ok: false, message: "Quiz not found or unauthorized." });
        }

        res.status(200).json({ ok: true, message: "Update successful", data: updatedQuiz });

    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};

export const getAllClubQuizzes = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { clubId, classId, sectionId, page = 1, limit = 10 } = req.query;
        const schoolId = req.user?.schoolId;

        const filter: any = { schoolId, isActive: true };
        if (clubId) filter.clubId = clubId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const quizzes = await ClubQuizModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate("clubId", "name")
            .populate("clubVideoId", "title");

        const total = await ClubQuizModel.countDocuments(filter);

        res.status(200).json({
            ok: true,
            data: quizzes,
            pagination: {
                total,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};


// Get Single Quiz
export const getSingleClubQuiz = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const quiz = await ClubQuizModel.findOne({ _id: id, schoolId: req.user?.schoolId });

        if (!quiz) return res.status(404).json({ ok: false, message: "Quiz not found" });

        res.status(200).json({ ok: true, data: quiz });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};

// Delete Quiz
export const deleteClubQuiz = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const deletedQuiz = await ClubQuizModel.findOneAndDelete({ _id: id, schoolId: req.user?.schoolId });

        if (!deletedQuiz) {
            return res.status(404).json({ ok: false, message: "Quiz not found or unauthorized" });
        }

        res.status(200).json({ ok: true, message: "Quiz deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ ok: false, message: error.message });
    }
};



//  AI QUIZ POWERED


export const createQuizWithAI = async (req: RoleBasedRequest, res: Response) => {
    try {
        let {
            clubId,
            clubVideoId,
            classId,
            sectionId,
            academicYear,
            numberOfQuestions = 10
        } = req.body;

        const schoolId = req.body.schoolId || req.user?.schoolId;


        if (!schoolId)

            // 1. Academic Year Fallback
            if (!academicYear) {
                const school = await SchoolModel.findById(schoolId).select("currentAcademicYear");

                academicYear = school?.currentAcademicYear;

                if (!academicYear) {
                    return res.status(400).json({ ok: false, message: "Academic year not provided and not set in school settings." });
                }
            }

        // 2. Fetch PDF from Record
        const videoRecord: any = await ClubVideoModel.findById(clubVideoId);
        if (!videoRecord || !videoRecord.pdfs?.length) {
            return res.status(404).json({ ok: false, message: "No PDF found for analysis." });
        }

        const pdfUrl = videoRecord.pdfs[0].url;
        const pdfResponse = await fetch(pdfUrl);
        const pdfBuffer = await pdfResponse.arrayBuffer();
        const base64Pdf = Buffer.from(pdfBuffer).toString("base64");

        // 3. New SDK Call Structure using 'ai'
        const response = await genAI.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: `Analyze this PDF. Generate a quiz title, a 1 sentence small description, and ${numberOfQuestions} MCQs based on the content. Each question must carry exactly 1 point.` },
                        { inlineData: { mimeType: "application/pdf", data: base64Pdf } }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    questionText: { type: "string" },
                                    options: { type: "array", items: { type: "string" } },
                                    correctOptionIndex: { type: "integer" },
                                    points: {
                                        type: "integer",
                                        enum: [1] // THIS FORCES THE AI TO ONLY USE THE VALUE 1
                                    }
                                },
                                required: ["questionText", "options", "correctOptionIndex", "points"]
                            }
                        }
                    },
                    required: ["title", "description", "questions"]
                }
            }
        });

        console.log("response", response)

        // 4. Parse the AI Response (Note: response.text is a property now)
        const aiGeneratedData = JSON.parse(response.text!);

        console.log("aiGeneratedData parsed", aiGeneratedData)


        // 5. Calculate Points and Save
        const totalPoints = aiGeneratedData.questions.reduce((sum: any, q: any) => sum + (q.points || 1), 0);

        console.log("total points", totalPoints)

        // Since each question is guaranteed to be 1 point via the Schema Enum:
        // const totalPoints = aiGeneratedData.questions.length;

        const newQuiz = new ClubQuizModel({
            schoolId,
            clubId,
            clubVideoId,
            classId,
            sectionId,
            academicYear,
            title: aiGeneratedData.title,
            description: aiGeneratedData.description,
            questions: aiGeneratedData.questions,
            totalPoints,
            isActive: true
        });

        await newQuiz.save();

        res.status(201).json({
            ok: true,
            message: "AI Quiz generated via Gemini 2.0 successfully",
            data: newQuiz
        });

    } catch (error: any) {
        console.error("Gemini 2.0 AI Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};
import mongoose, { Schema, Document, Types, model } from "mongoose";

// 1. Reusable Upload Interface
export interface IStudentUpload {
    type: "image" | "pdf";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

// 2. UDISE Mandatory Fields
export interface IStudentMandatory {
    gender?: string | null;
    dob?: string | null;
    educationNumber?: string | null;
    motherName?: string | null;
    fatherName?: string | null;
    guardianName?: string | null;
    aadhaarNumber?: string | null;
    aadhaarName?: string | null;
    address?: string | null;
    pincode?: string | null;
    mobileNumber?: string | null;
    alternateMobile?: string | null;
    email?: string | null;
    motherTongue?: string | null;
    socialCategory?: string | null;
    minorityGroup?: string | null;
    bpl?: string | null;
    aay?: string | null;
    ews?: string | null;
    cwsn?: string | null;
    impairments?: string | null;
    indian?: string | null;
    outOfSchool?: string | null;
    mainstreamedDate?: string | null;
    disabilityCert?: string | null;
    disabilityPercent?: string | null;
    bloodGroup?: string | null;
}

// 3. UDISE Non-Mandatory/Enrollment Fields
export interface IStudentNonMandatory {
    facilitiesProvided?: string | null;
    facilitiesForCWSN?: string | null;
    screenedForSLD?: string | null;
    sldType?: string | null;
    screenedForASD?: string | null;
    screenedForADHD?: string | null;
    isGiftedOrTalented?: string | null;
    participatedInCompetitions?: string | null;
    participatedInActivities?: string | null;
    canHandleDigitalDevices?: string | null;
    heightInCm?: string | null;
    weightInKg?: string | null;
    distanceToSchool?: string | null;
    parentEducationLevel?: string | null;
    admissionNumber?: string | null;
    admissionDate?: string | null;
    rollNumber?: string | null;
    mediumOfInstruction?: string | null;
    languagesStudied?: string | null;
    academicStream?: string | null;
    subjectsStudied?: string | null;
    statusInPreviousYear?: string | null;
    gradeStudiedLastYear?: string | null;
    enrolledUnder?: string | null;
    previousResult?: string | null;
    marksObtainedPercentage?: string | null;
    daysAttendedLastYear?: string | null;
}

// 4. Main Student Document Interface
export interface IStudentNew extends Document {
    schoolId: Types.ObjectId;
    srId?: string;
    newOld?: string;
    studentName: string;
    studentImage?: IStudentUpload | null;
    currentClassId?: Types.ObjectId | null;
    currentSectionId?: Types.ObjectId | null;
    isActive: boolean;
    clubs: Types.ObjectId[];
    mandatory: IStudentMandatory;
    nonMandatory: IStudentNonMandatory;
    createdAt: Date;
    updatedAt: Date;
}

const uploadSchema = new Schema<IStudentUpload>({
    type: { type: String, enum: ["image", "pdf"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
});



const StudentNewSchema = new Schema<IStudentNew>({
    // === MULTI-TENANCY ===
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    srId: {
        type: String,
    },
    // === BASIC INFO (Unchangeable/Static) ===
    newOld: { type: String },
    studentName: { type: String, required: true, },
    studentImage: { type: uploadSchema, default: null },

    currentClassId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassModel", default: null },
    currentSectionId: { type: mongoose.Schema.Types.ObjectId, ref: "SectionModel", default: null },

    isActive: { type: Boolean, default: true },

    clubs: [{ type: mongoose.Schema.Types.ObjectId, ref: "ClubMainModel" }],

    // === MANDATORY DETAILS (Parents, Aadhar, Address) ===
    mandatory: {
        gender: { type: String, default: null },
        dob: { type: String, default: null },
        educationNumber: { type: String, default: null },
        motherName: { type: String, default: null },
        fatherName: { type: String, default: null },
        guardianName: { type: String, default: null },
        aadhaarNumber: { type: String, default: null },
        aadhaarName: { type: String, default: null },
        address: { type: String, default: null },
        pincode: { type: String, default: null },
        mobileNumber: { type: String, default: null },
        alternateMobile: { type: String, default: null },
        email: { type: String, default: null },
        motherTongue: { type: String, default: null },
        socialCategory: { type: String, default: null },
        minorityGroup: { type: String, default: null },
        bpl: { type: String, default: null },
        aay: { type: String, default: null },
        ews: { type: String, default: null },
        cwsn: { type: String, default: null },
        impairments: { type: String, default: null },
        indian: { type: String, default: null },
        outOfSchool: { type: String, default: null },
        mainstreamedDate: { type: String, default: null },
        disabilityCert: { type: String, default: null },
        disabilityPercent: { type: String, default: null },
        bloodGroup: { type: String, default: null },
        // ... add any other specific mandatory fields here
    },

    // === NON-MANDATORY DETAILS (Health, Talents) (UDISE FORM) ===
    nonMandatory: {     
        facilitiesProvided: { type: String, default: null },
        facilitiesForCWSN: { type: String, default: null },
        screenedForSLD: { type: String, default: null },
        sldType: { type: String, default: null },
        screenedForASD: { type: String, default: null },
        screenedForADHD: { type: String, default: null },
        isGiftedOrTalented: { type: String, default: null },
        participatedInCompetitions: { type: String, default: null },
        participatedInActivities: { type: String, default: null },
        canHandleDigitalDevices: { type: String, default: null },
        heightInCm: { type: String, default: null }, // or number if preferred
        weightInKg: { type: String, default: null }, // or number
        distanceToSchool: { type: String, default: null },
        parentEducationLevel: { type: String, default: null },

        // ENTROLLMENT DETAILS 

        admissionNumber: { type: String, default: null },
        admissionDate: { type: String, default: null }, // Format: DD/MM/YYYY
        rollNumber: { type: String, default: null },
        mediumOfInstruction: { type: String, default: null },
        languagesStudied: { type: String, default: null },
        academicStream: { type: String, default: null },
        subjectsStudied: { type: String, default: null },
        statusInPreviousYear: { type: String, default: null },
        gradeStudiedLastYear: { type: String, default: null },
        enrolledUnder: { type: String, default: null },
        previousResult: { type: String, default: null },
        marksObtainedPercentage: { type: String, default: null },
        daysAttendedLastYear: { type: String, default: null },
    }

}, { timestamps: true });


StudentNewSchema.pre("save", async function (next) {
    // 1. Only run this if we are creating a NEW student
    // This prevents srId from changing during updates
    if (!this.isNew) {
        return next();
    }

    try {
        // 2. Find the last created student FOR THIS SCHOOL only
        const lastStudent = await mongoose.model("StudentNewModel").findOne(
            {},
            { srId: 1 },
            { sort: { createdAt: -1 } } // Get latest
        );

        let nextSequence = 1;

        if (lastStudent && lastStudent.srId) {
            // Format is SR-001 or SR-1000
            const parts = lastStudent.srId.split("-"); // ["SR", "001"]
            if (parts.length === 2) {
                const lastNum = parseInt(parts[1], 10);
                if (!isNaN(lastNum)) {
                    nextSequence = lastNum + 1;
                }
            }
        }

        // 3. Format the Sequence (Pad with 0s if less than 1000)
        // 1 -> "001", 99 -> "099", 100 -> "100", 1000 -> "1000"
        const sequenceString = nextSequence < 1000
            ? String(nextSequence).padStart(3, "0")
            : String(nextSequence);

        this.srId = `SR-${sequenceString}`;

        next();
    } catch (error:any) {
        next(error);
    }
});

StudentNewSchema.index({
    schoolId: 1,
    studentName: 1,
});

const StudentNewModel = mongoose.model('StudentNewModel', StudentNewSchema);
export default StudentNewModel;
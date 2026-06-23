import mongoose, { Schema, Document, Types, model } from "mongoose";

export interface ISchoolUpload {
    type: "image" | "pdf";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

export interface ISchoolSubscription {
    planName: "basic" | "standard" | "premium" | "custom" | null;
    modules: {
        attendance: boolean;
        studentRecord: boolean;
        expense: boolean;
        club: boolean;
        announcement: boolean;
    };
    validUntil: Date | null;
}

export interface ISchool extends Document {
    name: string;
    schoolCode: string;
    email?: string;
    phoneNo?: string;
    address?: string;
    currentAcademicYear?: string | null;
    logo: ISchoolUpload | null;
    subscription: ISchoolSubscription;
    isActive: boolean;
    socialPlatform: {
        facebook?: string | null;
        linkedin?: string | null;
        instagram?: string | null;
        youtube?: string | null;
    };
    academicTermDates: {
        academicYear: String,  // e.g., "2025-2026"
        firstTerm: Date | null
        secondTerm: Date | null
        thirdTerm: Date | null
    }[]
    createdAt: Date;
    updatedAt: Date;
}

// const uploadSchema = new Schema({
//     type: { type: String, enum: ["image", "pdf"] },
//     url: { type: String, },
//     originalName: String,
//     uploadedAt: { type: Date, default: new Date() }
// });


const uploadSchema = new Schema<ISchoolUpload>({
    type: { type: String, enum: ["image", "pdf"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
});


const subscriptionSchema = new Schema<ISchoolSubscription>({
    planName: {
        type: String,
        enum: ["basic", "standard", "premium", "custom", null],
        default: null
    },
    // The source of truth for features
    modules: {
        attendance: { type: Boolean, default: false },
        studentRecord: { type: Boolean, default: false }, // Core feature always true?
        expense: { type: Boolean, default: false },
        club: { type: Boolean, default: false },
        announcement: { type: Boolean, default: false }
    },
    validUntil: { type: Date, default: null } // Optional: For expiry
})

const termTimelineSchema = new Schema({
    academicYear: { type: String, required: true }, // e.g., "2025-2026"
    firstTerm: { type: Date, default: null },
    secondTerm: { type: Date, default: null },
    thirdTerm: { type: Date, default: null }
}, { _id: true });


const schoolSchema = new Schema<ISchool>(
    {
        name: { type: String, required: true },
        schoolCode: { type: String, }, // e.g., "SCH-001"
        email: { type: String, },
        phoneNo: { type: String },
        address: { type: String },
        currentAcademicYear: { type: String, default: null },

        // Optional: Logo or branding
        logo: {
            type: uploadSchema,
            default: null
        },

        subscription: {
            type: subscriptionSchema, default: {},
        },

        isActive: { type: Boolean, default: true },
        socialPlatform: {
            facebook: { type: String, default: null },
            linkedin: { type: String, default: null },
            instagram: { type: String, default: null },
            youtube: { type: String, default: null },
        },
        academicTermDates: { type: [termTimelineSchema], default: [] },
    },
    { timestamps: true }
);


// =========================================================
// PRE-SAVE HOOK: AUTO-GENERATE SCHOOL CODE
// =========================================================
schoolSchema.pre("save", async function (next) {
    // Only generate if this is a NEW document
    // If we are just updating an email or address, skip this logic.
    if (!this.isNew) {
        return next();
    }

    try {
        // 1. Find the most recently created school to determine the sequence
        const lastSchool = await mongoose.model("SchoolModel").findOne({}, {}, { sort: { createdAt: -1 } });

        let nextSequence = 1;

        if (lastSchool && lastSchool.schoolCode) {
            // Split "SCH-001-9988" -> ["SCH", "001", "9988"]
            const parts = lastSchool.schoolCode.split("-");
            if (parts.length >= 2) {
                const lastSequence = parseInt(parts[1], 10);
                if (!isNaN(lastSequence)) {
                    nextSequence = lastSequence + 1;
                }
            }
        }

        // 2. Format the Sequence (001, 002... 999, 1000, 1001)
        // If less than 1000, pad with zeros. If 1000 or more, keep as is.
        const sequenceString = nextSequence < 1000
            ? String(nextSequence).padStart(3, "0")
            : String(nextSequence);

        // 3. Generate Random 4-digit Suffix
        // We use a random number to make it unguessable
        // const randomSuffix = Math.floor(1000 + Math.random() * 9000); // Ensures 4 digits (1000 to 9999)
        const dateSuffix = Date.now().toString().slice(-4);


        // 4. Construct the Code
        this.schoolCode = `SCH-${sequenceString}-${dateSuffix}`;

        next();
    } catch (error: any) {
        next(error);
    }
});


schoolSchema.index({ schoolCode: 1 });


const SchoolModel = model("SchoolModel", schoolSchema);
export default SchoolModel;
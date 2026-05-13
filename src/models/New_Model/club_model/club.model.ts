
import mongoose, { Schema, Document, Types } from "mongoose";

// 1. Reusable Upload Interface (Sub-document)
export interface IUpload {
    _id?: Types.ObjectId; // Since you set _id: true in the schema
    type: "image" | "pdf" | "video";
    key?: string;
    url?: string;
    originalName?: string;
    uploadedAt: Date;
}

// 2. Main Club Interface
export interface IClub extends Document {
    schoolId: Types.ObjectId | null;
    classId: Types.ObjectId | null;
    name?: string;
    description?: string;
    studentId: Types.ObjectId[];
    thumbnail?: IUpload;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// 3. Club Video/Content Interface
export interface IClubVideo extends Document {
    clubId: Types.ObjectId;
    academicYear?: string | null;
    title?: string | null;
    video?: IUpload | null;
    pdfs: IUpload[];
    topic?: string | null;
    level: string;
    uploadedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const uploadSchema = new Schema<IUpload>({
    type: { type: String, enum: ["image", "pdf", "video"] },
    key: { type: String, },
    url: { type: String, },
    originalName: String,
    uploadedAt: { type: Date, default: new Date() }
}, { _id: true });

const clubSchema = new Schema<IClub>({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolModel", default: null },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassModel", default: null },

    name: {
        type: String
    },
    description: {
        type: String,
    },
    studentId: [{ type: mongoose.Schema.Types.ObjectId, ref: "StudentNewModel" }],
    // REPLACED: thumbnailUrl string
    // WITH: Your uploadSchema structure
    thumbnail: {
        type: uploadSchema,
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });



const clubVideoSchema = new Schema<IClubVideo>({
    clubId: {
        type: Schema.Types.ObjectId,
        ref: 'ClubMainModel',
        // required: true
    },
    academicYear: {
        type: String, default: null,
    },
    title: {
        type: String,
        default: null,
        // required: true,
        // trim: true
    },

    // REPLACED: videoUrl string
    // WITH: Your uploadSchema structure
    video: {
        type: uploadSchema,
        // required: true
        default: null,
    },

    pdfs: {
        type: [uploadSchema],
        default:[]
    },

    // Categorization (As per requirements)
    topic: {
        type: String,
        // required: true // e.g. "Kinematics" or "Modern Art"
        default: null,

    },

    level: {
        type: String,
        default: 'general'
    },

    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'UserModel' // Assuming you have a User model for admin/staff
    }
}, { timestamps: true });


clubSchema.index({ schoolId: 1, });
clubVideoSchema.index({clubId:1});

const ClubVideoModel = mongoose.model('ClubVideoModel', clubVideoSchema);
const ClubMainModel = mongoose.model('ClubMainModel', clubSchema);

export { ClubVideoModel, ClubMainModel }
import mongoose, { Schema, Document, Types, model } from "mongoose";

export interface IUserAssignment {
  _id?: Types.ObjectId;
  classId: Types.ObjectId;
  sectionId: Types.ObjectId | null;
}

// 1. Reusable Upload Interface
export interface IUpload {
  type: "image";
  key?: string;
  url?: string;
  originalName?: string;
  uploadedAt: Date;
}

export interface IUser extends Document {
  email?: string;
  userName: string;
  password: string;
  role: "correspondent" | "teacher" | "principal" | "viceprincipal" | "administrator" | "parent" | "accountant" | null;
  phoneNo?: string;
  schoolCode?: string | null;
  schoolId: Types.ObjectId | null;
  isPlatformAdmin?: boolean;
  assignments: IUserAssignment[];
  studentId: Types.ObjectId[]; // Links to children if role is parent
  profileImage: IUpload | null
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IUserAssignment>({
  classId: { type: Schema.Types.ObjectId, ref: "ClassModel" },
  // sectionId is Nullable (for classes like LKG that don't have sections)
  sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel", default: null },
}, { _id: true });


const uploadSchema = new Schema<IUpload>({
  type: { type: String, enum: ["image"] },
  key: { type: String, },
  url: { type: String, },
  originalName: String,
  uploadedAt: { type: Date, default: new Date() }
});

const userSchema = new Schema<IUser>(
  {
    email: { type: String, },
    userName: { type: String, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      // required: true, 
      // enum: ["correspondent", "teacher", "principal", "viceprincipal", "administrator", "parent", "accountant", null]
    },
    phoneNo: { type: String },
    schoolCode: { type: String, default: null },
    schoolId: { type: mongoose.Schema.ObjectId, default: null, ref: "SchoolModel" },
    isPlatformAdmin: { type: Boolean }, // internal field for conditional storage
    profileImage: {
      type: uploadSchema, default: null
    },

    // only for teachers
    assignments: { type: [assignmentSchema] },
    studentId: { type: [mongoose.Schema.ObjectId], ref: "StudentNewModel" }

  },
  { timestamps: true }
);

userSchema.index({ schoolId: 1 })

const UserModel = model("UserModel", userSchema);

export default UserModel;

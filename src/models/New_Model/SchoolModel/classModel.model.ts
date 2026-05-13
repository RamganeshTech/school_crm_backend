import mongoose, { Schema, Document, Types, model } from "mongoose";

export interface IClass extends Document {
    schoolId: Types.ObjectId;
    name: string;
    order: number;
    hasSections: boolean;
    classTeacherId: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}


const classSchema = new Schema<IClass>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "SchoolModel", required: true },
    name: { type: String, required: true }, // e.g., "LKG", "Grade 10"
    
    // Sorting order (so LKG comes before Grade 1 in dropdowns)
    order: { type: Number, default: 0 }, 

    // LOGIC: Does this class have sections (A, B, C)? 
    // If FALSE (e.g. LKG), we assign the teacher here.
    hasSections: { type: Boolean, default: true },

    // ASSIGN TEACHER: Only used if hasSections = false
    classTeacherId: { type: [Schema.Types.ObjectId], ref: "UserModel", default: [] },
  },
  { timestamps: true }
);

// Prevent duplicate class names within the same school
// classSchema.index({ schoolId: 1, name: 1 }, { unique: true });
classSchema.index({ schoolId: 1});

const ClassModel = model("ClassModel", classSchema);
export default ClassModel;
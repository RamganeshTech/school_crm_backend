import mongoose , { Document, Types } from "mongoose";

export interface StudentProfileUpdateDoc extends Document {
  studentId: Types.ObjectId;
  schoolId: Types.ObjectId;
  requestedBy: Types.ObjectId;

  changes: Map<string, string>;
  previousValues: Map<string, string>;
  section?: Map<string, string>;

  status: "pending" | "approved" | "rejected";

  reviewedBy?: Types.ObjectId;

  reviewNote: string;

  createdAt: Date;
  updatedAt: Date;
}

const StudentProfileUpdateSchema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'StudentNewModel', required: true },
  schoolId:       { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolModel',  required: true },
  requestedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel',    required: true }, // parent userId
  changes:        { type: Map, of: String,  },  // { "Father Name": "New Value" }
  previousValues: { type: Map, of: String,  },  // { "Father Name": "Old Value" }
  section:        { type: Map, of: String },                  // { "Father Name": "mandatory" }
  status:         { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  reviewedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' },
  reviewNote:     { type: String, default: '' },
}, { timestamps: true });

// Index for fast lookups
StudentProfileUpdateSchema.index({ studentId: 1, status: 1 });
StudentProfileUpdateSchema.index({ schoolId: 1, status: 1 });


const StudentProfileUpdate = mongoose.model('StudentProfileUpdateModel', StudentProfileUpdateSchema);
export default StudentProfileUpdate;
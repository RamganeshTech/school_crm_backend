import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFeeConfig extends Document {
  schoolId: mongoose.Types.ObjectId;
  // feeHeads: string[];  // e.g., ["Tuition Fee", "Transport Fee", "Library Fee"]

  feeHeads: {
    feeHead: string
    associatedTerm: string
    isTerm: boolean
  }[]
  createdAt: Date;
  updatedAt: Date;
}


const feeHead = new Schema({
  feeHead: { type: String, trim: true },
  associatedTerm: { type: String, default: null },
  isTerm: { type: Boolean, default: false }
}, { _id: true })

const FeeConfigSchema = new Schema<IFeeConfig>({
  schoolId: { type: Schema.Types.ObjectId, ref: 'SchoolModel', required: true },

  feeHeads: { type: [feeHead], default: [] },

}, { timestamps: true });

// 🌟 CRITICAL: Ensure a school can only have ONE config per academic year
FeeConfigSchema.index({ schoolId: 1 });

// const FeeStructureConfigModel = mongoose.models.FeeStructureConfigModel || mongoose.model<IFeeConfig>('FeeStructureConfigModel', FeeConfigSchema);

const FeeStructureConfigModel: Model<IFeeConfig> =
  (mongoose.models.FeeStructureConfigModel as Model<IFeeConfig>) ||
  mongoose.model<IFeeConfig>(
    "FeeStructureConfigModel",
    FeeConfigSchema
  );

// const FeeStructureConfigModel = mongoose.model<IFeeConfig>('FeeStructureConfigModel', FeeConfigSchema);

export default FeeStructureConfigModel;
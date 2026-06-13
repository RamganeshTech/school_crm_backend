import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFeeConfig extends Document {
    schoolId: mongoose.Types.ObjectId;
    feeHeads: string[];  // e.g., ["Tuition Fee", "Transport Fee", "Library Fee"]
    createdAt: Date;
    updatedAt: Date;
}


const FeeConfigSchema = new Schema<IFeeConfig>({
    schoolId: { type: Schema.Types.ObjectId, ref: 'SchoolModel' , required:true},
    
    feeHeads: [{ type: String, trim: true }], 
    
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
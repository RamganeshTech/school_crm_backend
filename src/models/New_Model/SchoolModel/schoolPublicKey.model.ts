// models/New_Model/SchoolPublicKeyModel/schoolPublicKey.model.ts
import mongoose, { Schema, Model } from 'mongoose'

export interface ISchoolPublicKey {
    schoolId: mongoose.Types.ObjectId
    publicKey: string
    registeredAt: Date
    isActive: boolean
    updatedAt: Date
}

const SchoolPublicKeySchema = new Schema<ISchoolPublicKey>(
    {
        schoolId: {
            type: Schema.Types.ObjectId,
            ref: 'SchoolModel',
            required: true,
            unique: true
        },
        publicKey: {
            type: String,
            required: true
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
)


SchoolPublicKeySchema.index({ schoolId: 1 })

const SchoolPublicKeyModel: Model<ISchoolPublicKey> =
    (mongoose.models.SchoolPublicKeyModel as Model<ISchoolPublicKey>) ||
    mongoose.model<ISchoolPublicKey>('SchoolPublicKeyModel', SchoolPublicKeySchema)

export default SchoolPublicKeyModel
// models/New_Model/DesktopDownloadModel/desktopDownload.model.ts
import mongoose, { Schema, Model } from 'mongoose'

export interface IDesktopDownload {
    schoolId: mongoose.Types.ObjectId
    startedCount: number
    completedCount: number
    // versionCounts: Map<string, number>
    firstCompletedAt?: Date
    lastCompletedAt?: Date
}

const DesktopDownloadSchema = new Schema<IDesktopDownload>(
    {
        schoolId: { type: Schema.Types.ObjectId, ref: 'SchoolModel', required: true, unique: true },
        startedCount: { type: Number, default: 0 },
        completedCount: { type: Number, default: 0 },
        // versionCounts: { type: Map, of: Number, default: {} },
        firstCompletedAt: Date,
        lastCompletedAt: Date
    },
    { timestamps: true }
)

const DesktopDownloadModel: Model<IDesktopDownload> =
    (mongoose.models.DesktopDownloadModel as Model<IDesktopDownload>) ||
    mongoose.model<IDesktopDownload>('DesktopDownloadModel', DesktopDownloadSchema)

export default DesktopDownloadModel
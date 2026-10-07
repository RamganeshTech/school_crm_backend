// controllers/DesktopDownloadController/desktopDownload.controller.ts
import { type Response } from 'express'
import { pipeline } from 'stream'
import jwt from 'jsonwebtoken'
// import { s3, S3_BUCKET } from '../../config/s3' // adjust to your actual path
// import DesktopDownloadModel from '../../models/New_Model/DesktopDownloadModel/desktopDownload.model'
import type { RoleBasedRequest } from '../../../utils/types.js'
import { s3, S3_BUCKET } from '../../../config/awssdk.js'
import DesktopDownloadModel from '../../../models/New_Model/desktopAppMonitor_model/desktopAppMonitor.model.js'

const VERSION = '1.0.0'
const FILE_NAME = `daily-grades-offline-${VERSION}-setup.exe`
const S3_KEY = `installers/${FILE_NAME}`



// Step 1: authenticated, returns a short-lived download token. Counts nothing.
export const createDesktopDownloadToken = async (req: RoleBasedRequest, res: Response):Promise<any> => {
    try {
        const schoolId = (req as any).user?.schoolId // adjust to how your auth stores the school
        if (!schoolId) {
            return res.status(400).json({ ok: false, message: 'School not found for user' })
        }

        const token = jwt.sign({ schoolId, purpose: 'desktop-download' }, process.env.JWT_SECRET as string, {
            expiresIn: '5m'
        })

        return res.status(200).json({
            ok: true,
            message: 'Download token created',
            data: { downloadUrl: `/api/downloads/windows?token=${token}` }
        })
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message || 'Failed to create download token' })
    }
}


export const downloadDesktopInstaller = async (req: RoleBasedRequest, res: Response) => {
    let schoolId: string

    try {
        const decoded: any = jwt.verify(req.query.token as string, process.env.JWT_SECRET as string)
        if (decoded.purpose !== 'desktop-download') throw new Error('bad purpose')
        schoolId = decoded.schoolId
    } catch {
        return res.status(401).json({ ok: false, message: 'Invalid or expired download link' })
    }

    try {
        // headObject fails early if the key is wrong or the credentials lack access
        const head = await s3.headObject({ Bucket: S3_BUCKET, Key: S3_KEY }).promise()

        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${FILE_NAME}"`)
        res.setHeader('Content-Length', String(head.ContentLength))
        res.setHeader('X-Accel-Buffering', 'no')


        await DesktopDownloadModel.updateOne({ schoolId }, { $inc: { startedCount: 1 } }, { upsert: true })

        const s3Stream = s3.getObject({ Bucket: S3_BUCKET, Key: S3_KEY }).createReadStream()

        pipeline(s3Stream, res, async (err) => {
            if (err) return // cancelled or failed midway: not counted

            const now = new Date()
            try {
                await DesktopDownloadModel.updateOne(
                    { schoolId },
                    {
                        $inc: { completedCount: 1},
                        $set: { lastCompletedAt: now },
                        $min: { firstCompletedAt: now }
                    },
                    { upsert: true }
                )
            } catch (e) {
                console.error('download count update failed:', e)
            }
        })
    } catch (error: any) {
        console.error('downloadDesktopInstaller error:', error)
        if (!res.headersSent) {
            res.status(500).json({ ok: false, message: error.message || 'Download failed' })
        }
    }
}



// Report for you: how many schools completed a download, and how many times each.
export const getDesktopDownloadReport = async (_req: RoleBasedRequest, res: Response):Promise<any> => {
    try {
        const rows = await DesktopDownloadModel.find({ completedCount: { $gt: 0 } })
            .populate('schoolId', 'name')
            .select('schoolId startedCount completedCount lastCompletedAt')
            .sort({ lastCompletedAt: -1 })
            .lean()

        return res.status(200).json({
            ok: true,
            message: 'Download report fetched',
            data: { totalSchools: rows.length, schools: rows }
        })
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message || 'Failed to fetch report' })
    }
}
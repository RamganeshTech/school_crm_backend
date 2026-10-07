// routes/desktopDownloadRoutes.ts
import { Router } from 'express'
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js'
import { createDesktopDownloadToken, downloadDesktopInstaller, getDesktopDownloadReport } from '../../../controllers/New_Controllers/desktopDownload_controllers/desktopDownload.controller.js'

const desktopDownloadRoutes = Router()

// 1. Logged-in user asks for a short-lived download token (nothing is counted here)
desktopDownloadRoutes.get(
    '/token',
    multiRoleAuth('correspondent', 'principal', 'administrator', 'viceprincipal', 'accountant'),
    createDesktopDownloadToken
)

// 2. Browser opens this link. NO auth middleware, because a plain browser navigation
//    can't send your auth header. The token in the query string is the protection.
desktopDownloadRoutes.get('/windows', downloadDesktopInstaller)

// 3. Your internal report of which schools completed a download.
//    Protect it with whatever admin-only middleware you use for your own team.
desktopDownloadRoutes.get('/report', 
    multiRoleAuth('correspondent', 'principal', 'administrator',),
    
    getDesktopDownloadReport)

export default desktopDownloadRoutes
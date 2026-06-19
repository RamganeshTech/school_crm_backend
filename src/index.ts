
import express, { type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import http from 'http';
import './config/redisConfig.js';

// const mongoose = require('mongoose');
// const cookieParser = require('cookie-parser')
// const cors = require("cors");
// const connectDB = require('./Config/ConnectDB');
// // require('dotenv').config()

// require('dotenv').config({ path: '.env.production' });

// const adminRoutes = require('./Routes/adminRoutes')
// const accountantRoutes = require('./Routes/accountantRoutes');
// const { default: schoolRoutes } = require('./Routes/New_Routes/school_routes/school.routes');

// import adminRoutes from "./Routes/adminRoutes.ts"
// import accountantRoutes from "./Routes/accountantRoutes.js"
import schoolRoutes from './routes/New_Routes/school_routes/school.routes.js';
// import connectDB from './Config/ConnectDB.js';
import userRoutes from './routes/New_Routes/user_routes/user.routes.js';
import classRoutes from './routes/New_Routes/school_routes/class_routes/class.routes.js';
import sectionRoutes from './routes/New_Routes/school_routes/section_routes/section.routes.js';
import teacherRoutes from './routes/New_Routes/teacher_routes/teacher.routes.js';
import feeStructureRoutes from './routes/New_Routes/feeStructure_routes/feeStructure.routes.js';
import studentRoutes from './routes/New_Routes/studentNew_routes/studentNew.routes.js';
import studentRecordRoutes from './routes/New_Routes/studentNew_routes/studentRecord_route/studentRecord.route.js';
import attendanceRoutes from './routes/New_Routes/attendance_routes/attendance.routes.js';
import downloadRoutes from './routes/New_Routes/download_routes/download.routes.js';
import expenseRoutes from './routes/New_Routes/expense_routes/expense.routes.js';
import deleteArchiveRoutes from './routes/New_Routes/deleteArchive_routes/deleteArchieve.routes.js';
import financeRoutes from './routes/New_Routes/financeLedger_routes/financeLedger.routes.js';
import annoucementRoutes from './routes/New_Routes/announcement_routes/annoucement.routes.js';
import clubRoutes from './routes/New_Routes/club_routes/club.routes.js';
import auditRoutes from './routes/New_Routes/audit_routes/audit.routes.js';
import feeReceiptRoutes from './routes/New_Routes/feeTrasaction_receipt_routes/feeTrasactionReceipt.routes.js';
import subscriptionRoutes from './routes/New_Routes/subscription_routes/subscription.routes.js';
import timeTableRoutes from './routes/New_Routes/TimeTable_routes/timeTable.routes.js';
import HomeWorkRoutes from './routes/New_Routes/HomeWork_routes/homework.routes.js';
import HomeWorkSubmissionRoutes from './routes/New_Routes/HomeWork_routes/homeWorkSubmission.route.js';
import clubQuizRoutes from './routes/New_Routes/club_routes/clubQuiz.routes.js';
import clubQuizAttemptRoutes from './routes/New_Routes/club_routes/clubQuizAttempt.routes.js';
import PendingTaskRoutes from './routes/New_Routes/pendingTask_routes/pendingTask.routes.js';
import CalendarRoutes from './routes/New_Routes/academicCalendar_routes/academicCaledar.routes.js';
import connectDB from './config/connectDB.js';
import type { RoleBasedRequest } from './utils/types.js';
import { initSocket } from './config/socket.js';
import markReportConfigRoutes from './routes/New_Routes/markReportCard_routes/markReportCofig.routes.js';
import markReportRoutesV1 from './routes/New_Routes/markReportCard_routes/markReportCardv1.routes.js';
import markReportRoutes from './routes/New_Routes/markReportCard_routes/markReportCard.routes.js';
import feeStructureConfigRoutes from './routes/New_Routes/feeStructure_routes/feeStructrueConfig.routes.js';
import schoolBillBookRoutes from './routes/New_Routes/school_routes/billBook_routes/billBook.routes.js';
import schoolAdmissionBookRoutes from './routes/New_Routes/school_routes/admission_routes/admissionBook.route.js';
import schoolAdmissionFormRoutes from './routes/New_Routes/school_routes/admission_routes/admissionForm.routes.js';
import ProgressBarRoutes from './routes/New_Routes/progress_routes/progress.routes.js';


dotenv.config({ path: '.env.production' });
const app = express()
const server = http.createServer(app);

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}))

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
// app.use(express.json({ limit: "50mb" }));


// app.use('/api/admin', adminRoutes)
// app.use('/api/accountant', accountantRoutes)

// NEW ROUTES
app.use('/api/school', schoolRoutes)
app.use('/api/user', userRoutes)
app.use('/api/class', classRoutes)
app.use('/api/section', sectionRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/feestructure', feeStructureRoutes)
app.use('/api/fee-config', feeStructureConfigRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/studentrecord', studentRecordRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/fee/receipt', feeReceiptRoutes)

app.use('/api/school-config/bill-book', schoolBillBookRoutes)
app.use('/api/school-config/admission-book', schoolAdmissionBookRoutes)
app.use('/api/school/admission-form', schoolAdmissionFormRoutes)
app.use('/api/school/progress-bar', ProgressBarRoutes)


app.use('/api/timetable', timeTableRoutes)
app.use('/api/homework', HomeWorkRoutes)
app.use('/api/homework/submission', HomeWorkSubmissionRoutes)
app.use('/api/pending', PendingTaskRoutes)
app.use('/api/calendar', CalendarRoutes);

app.use('/api/expense', expenseRoutes)
app.use('/api/announcement', annoucementRoutes)
app.use('/api/club', clubRoutes);
app.use('/api/club/quiz/attempt', clubQuizAttemptRoutes)
app.use('/api/club/quiz', clubQuizRoutes)

app.use('/api/markreport',markReportRoutes)
app.use('/api/markreport/v1', markReportRoutesV1)
app.use('/api/markreport/config', markReportConfigRoutes)

// not mentioned in the docuemntation
app.use('/api/financeledger', financeRoutes)
app.use('/api/deletearchive', deleteArchiveRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/subscription', subscriptionRoutes)
// not mentioned in the docuemntation


app.use('/api/download', downloadRoutes)

// app.use("/api/feereceipt")




app.get("/api/health-check", (req: RoleBasedRequest, res: Response) => {
    res.status(200).json({
        ok: true,
        message: "Server is up and running!",
        timestamp: new Date()
    });
});


initSocket(server);

let PORT = process.env.PORT || 4000

connectDB().then(() => {
    // app.listen(PORT, () => {
    //     console.log(`Server running in the http://locahost:${PORT}`)
    // })

    server.listen(PORT, () => {
        console.log(`🚀 HTTP & Socket Server running on http://localhost:${PORT}`);
    });
}).catch(err => console.log(err.message))
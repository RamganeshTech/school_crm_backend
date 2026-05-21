import mongoose, { Types } from "mongoose";
import { FinanceLedgerModel } from "../../../models/New_Model/financeLedger_model/financeLedger.model.js";
import StudentRecordModel from "../../../models/New_Model/StudentModel/StudentRecordModel/studentRecord.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";

export const createLedgerEntry = async ({
    schoolId,
    academicYear, // e.g., "2024-2025"
    transactionType, // "CREDIT" or "DEBIT"
    amount,
    date,
    referenceModel, // "ExpenseModel" or "StudentFeeModel"
    referenceId,    // The _id of the expense/fee
    studentRecordId = null,
    category,       // "Salary", "Term 1 Fee", etc.
    section,
    paymentMode,
    feeReceiptId = null,
    description,
    createdBy       // User ID (Accountant/Admin)
}: {
    schoolId: string | Types.ObjectId,
    academicYear: string,
    transactionType: string,
    amount: number,
    date: Date | string,
    referenceModel: string,
    referenceId: string | Types.ObjectId,
    studentRecordId?: string | Types.ObjectId | null,
    category: string,
    section: string,
    paymentMode: string,
    feeReceiptId?: string | Types.ObjectId | null,
    description: string,
    createdBy: string | Types.ObjectId
}, session: null | any = null) => {
    try {



        const newEntry = new FinanceLedgerModel({
            schoolId,
            academicYear,
            transactionType,
            amount,
            date: date || new Date(),
            referenceModel,
            referenceId,
            section,
            studentRecordId,
            feeReceiptId,
            category,
            paymentMode,
            description,
            createdBy,
            status: "active" // Default status
        });

        // await newEntry.save();


        // ✅ USE SESSION ONLY IF PROVIDED
        if (session) {
            await newEntry.save({ session });
        } else {
            await newEntry.save();
        }

        console.log(`[Ledger] New ${transactionType} entry created: ${amount}`, newEntry);
        return newEntry;
    } catch (error: any) {
        // Critical Error: If Ledger fails, your financial reports will be wrong.
        // We log it heavily. In a strict system, you might want to throw error to rollback the transaction.
        console.error("[Ledger Error] Failed to create entry:", error);
        return null;
    }
};




export const getAllTransactions = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            schoolId,
            academicYear,
            transactionType, // CREDIT or DEBIT
            accountType,     // CASH_IN_HAND or BANK_ACCOUNT
            status,          // active or cancelled
            paymentMode,
            section,
            fromDate,
            toDate,
            page = 1,
            limit = 10
        } = req.query;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        // 1. Build Query
        const query: any = { schoolId: new mongoose.Types.ObjectId(schoolId) };

        if (academicYear) query.academicYear = academicYear;
        if (transactionType) query.transactionType = transactionType;
        if (accountType) query.accountType = accountType;
        if (status) query.status = status;
        if (paymentMode) query.paymentMode = paymentMode;
        if (section) query.section = section;

        // Date Range Filter
        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) query.date.$gte = new Date(fromDate);
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                query.date.$lte = endDate;
            }
        }

        // Optimize Parsing
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;

        // 2. Execute Fetch and Count in Parallel
        const [transactions, totalDocs] = await Promise.all([
            FinanceLedgerModel.find(query)
                .populate("studentRecordId", "studentId className sectionId classId sectionName _id")
                .populate("referenceId")
                .populate("createdBy", "userName role _id")
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            FinanceLedgerModel.countDocuments(query)
        ]);



        res.status(200).json({
            ok: true,
            message: "Transactions fetched successfully",
            data: transactions,
            pagination: {
                total: totalDocs,
                currentPage: pageNum,
                totalPages: Math.ceil(totalDocs / limitNum),
                limit: limitNum
            }
        });

    } catch (error: any) {
        console.error("Get All Finance Error:", error);
        res.status(500).json({ ok: false, message: "Failed to fetch transactions", error: error.message });
    }
};




export const getTransactionById = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ ok: false, message: "Invalid Transaction ID" });
        }

        const transaction = await FinanceLedgerModel.findById(id)
            .populate("studentRecordId", "studentId className sectionName _id")
            .populate("referenceId")
            .populate("feeReceiptId")
            .populate("createdBy", "userName role _id")
            .populate("cancelledBy", "userName role _id");

        if (!transaction) {
            return res.status(404).json({ ok: false, message: "Transaction not found" });
        }

        res.status(200).json({
            ok: true,
            data: transaction
        });

    } catch (error: any) {
        console.error("Get Transaction By ID Error:", error);
        res.status(500).json({ ok: false, message: "Failed to fetch transaction", error: error.message });
    }
};






//  START OF NEW VERSION


// ==========================================
// HELPER: Date Range Calculator
// ==========================================
// This allows you to pass ?range=today or ?range=month instead of calculating dates on frontend
const getDateRange = (range: any, customStart: any, customEnd: any) => {
    const today = new Date();
    // Reset to start of day
    today.setHours(0, 0, 0, 0);

    let start = new Date(today);
    let end = new Date(today);
    end.setHours(23, 59, 59, 999);



    switch (range) {
        case 'today':
            // start/end are already set to today
            break;
        case 'week':
            // Set to Monday of this week
            const day = start.getDay() || 7; // Get current day number, convert Sun(0) to 7
            if (day !== 1) start.setHours(-24 * (day - 1));
            break;
        case 'month':
            start.setDate(1); // 1st of this month
            break;
        case 'year':
            start.setMonth(0, 1); // Jan 1st of this year
            break;
        case 'custom':
            if (customStart) start = new Date(customStart);
            if (customEnd) end = new Date(customEnd);
            end.setHours(23, 59, 59, 999); // Ensure end date includes the whole day
            break;
        default:
            // Default to 'all' or specific logic (e.g., current month)
            start.setDate(1);
            break;
    }

    return { start, end };
};

// ==========================================
// 1. KPI & SUMMARY API (Totals for Income, Expense, Net)
// ==========================================
// Use for: KPI Cards, "Today's Collection", "MTD Expense"

// esting /stats (KPI Cards)
// Used for: "Today's Collection", "Total Expense MTD", "Net Balance".

// Scenario A: Get Today's Numbers
// {{baseURL}}/api/financeledger/stats?schoolId=6942923ab194c60dc810cc6b&range=today

// Scenario B: Get This Month's Numbers (MTD)
// {{baseURL}}/api/financeledger/stats?schoolId=6942923ab194c60dc810cc6b&range=month

// Scenario C: Get Custom Date Range (e.g., Oct 1 to Oct 31)
// Note: Format is YYYY-MM-DD
// {{baseURL}}/api/financeledger/stats?schoolId=6942923ab194c60dc810cc6b&range=custom&startDate=2023-10-01&endDate=2023-10-31

// Scenario D: Get Stats ONLY for Student Fees (Income)
// NOTE: Use this to see totals related strictly to fee collection, ignoring any other income sources if they exist.
// {{baseURL}}/api/financeledger/stats?schoolId=6942923ab194c60dc810cc6b&range=month&section=student_record
// Expected Result: You should see totalExpense as 0 (since student records are usually credits), and totalIncome will show the fee amount.

// Scenario E: Get Stats ONLY for Expenses
// NOTE: Use this to see totals strictly for the expense department.
// {{baseURL}}/api/financeledger/stats?schoolId=6942923ab194c60dc810cc6b&range=month&section=expense
// Expected Result: You should see totalIncome as 0 (mostly), and totalExpense showing the spending.



export const getFinanceStats = async (req: RoleBasedRequest, res: Response) => {
    try {
        let { schoolId, range, startDate, endDate, section } = req.query;

        range = (range && range.trim() !== "") ? range : "month";

        // 1. Calculate Date Range
        const { start, end } = getDateRange(range, startDate, endDate);

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        // 2. Build Query
        const query: any = {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            status: "active", // Ignore cancelled
            date: { $gte: start, $lte: end }
        };

        // Optional Section Filter (Works for both Fee Receipts and Section-wise Expenses)
        if (section) {
            query.section = section;
        }

        // 3. Aggregate
        const stats = await FinanceLedgerModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalIncome: {
                        $sum: { $cond: [{ $eq: ["$transactionType", "CREDIT"] }, "$amount", 0] }
                    },
                    totalExpense: {
                        $sum: { $cond: [{ $eq: ["$transactionType", "DEBIT"] }, "$amount", 0] }
                    },
                    transactionCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalIncome: 1,
                    totalExpense: 1,
                    netBalance: { $subtract: ["$totalIncome", "$totalExpense"] },
                    transactionCount: 1
                }
            }
        ]);

        const result = stats[0] || { totalIncome: 0, totalExpense: 0, netBalance: 0, transactionCount: 0 };

        res.status(200).json({
            ok:true,
            rangeUsed: range,
            dateStart: start.toDateString(),
            dateEnd: end.toDateString(),
            data: result
        });

    } catch (error: any) {
        console.error("Stats Error:", error);
        res.status(500).json({ message: "Error fetching finance stats", ok:false });
    }
};

// ==========================================
// 2. TIMELINE API (Charts: Daily/Monthly Trends)
// ==========================================
// Use for: "Income vs Expense" Bar/Line Chart



// Scenario A: Daily Trend (For the Current Month)
// Returns data grouped by Day (e.g., 1st, 2nd, 3rd...)
// {{baseURL}}/api/financeledger/timeline?schoolId=6942923ab194c60dc810cc6b&range=month

// Scenario B: Track Expense Trend Only
// Use this for a line chart showing how expenses fluctuate day-by-day this month.
// {{baseURL}}/api/financeledger/timeline?schoolId=6942923ab194c60dc810cc6b&range=month&section=expense

// Scenario C: Track Fee Collection Trend Only
// Use this for a bar chart showing daily fee collections.
// {{baseURL}}/api/financeledger/timeline?schoolId=6942923ab194c60dc810cc6b&range=month&section=student%20record

// Scenario D: Monthly Trend (For the Current Year)
// Returns data grouped by Month (e.g., Jan, Feb, Mar...)
// {{baseURL}}/api/financeledger/timeline?schoolId=6942923ab194c60dc810cc6b&range=year

// Scenario E: Daily Trend (For the Current Week)
// {{baseURL}}/api/financeledger/timeline?schoolId=6942923ab194c60dc810cc6b&range=week

export const getFinanceTimeline = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, range, startDate, endDate, section } = req.query;
        const { start, end } = getDateRange(range || 'month', startDate, endDate);

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }


        const query: any = {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            status: "active",
            date: { $gte: start, $lte: end }
        };

        if (section) query.section = section;

        // Decide grouping format based on range
        // If range is 'year', group by Month (YYYY-MM)
        // If range is 'month' or 'week', group by Day (YYYY-MM-DD)
        const format = (range === 'year') ? "%Y-%m" : "%Y-%m-%d";

        const timeline = await FinanceLedgerModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        dateLabel: { $dateToString: { format: format, date: "$date" } },
                        type: "$transactionType"
                    },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { "_id.dateLabel": 1 } }
        ]);

        // Transform for easy Frontend Chart consumption
        // Output: [{ date: "2023-10-01", income: 5000, expense: 200 }, ...]
        const formattedData: any = {};

        timeline.forEach(item => {
            const date = item._id.dateLabel;
            const type = item._id.type;
            const amount = item.total;

            if (!formattedData[date]) {
                formattedData[date] = { date, income: 0, expense: 0 };
            }

            if (type === "CREDIT") formattedData[date].income = amount;
            if (type === "DEBIT") formattedData[date].expense = amount;
        });

        res.status(200).json({
            //  dateStart: start.toDateString(),
            // dateEnd: end.toDateString(),
            ok:true,
            data: Object.values(formattedData)
        });

    } catch (error: any) {
        res.status(500).json({ message: "Error fetching timeline",ok:false });
    }
};

// ==========================================
// 3. OUTSTANDING FEES API (Total Due)
// ==========================================
// Use for: KPI Card "Total Pending" and Pie Chart "Collected vs Pending"
// NOTE: This queries StudentRecordModel, NOT FinanceLedger
export const getOutstandingStats = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, academicYear, section } = req.query;


        if (!schoolId || !academicYear) {
            return res.status(400).json({ ok: false, message: "schoolId and academicYear is required" });
        }

        const query = {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            isActive: true,
            academicYear: academicYear
        };

        // if (academicYear) query.academicYear = academicYear;
        // Assuming StudentRecord has a field like 'currentClass' or 'section'
        // if (section) query["classDetails.section"] = section; 

        // Aggregate Dues from Student Records
        const stats = await StudentRecordModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalAdmissionDue: { $sum: "$dues.admissionDues" },
                    totalTerm1Due: { $sum: "$dues.firstTermDues" },
                    totalTerm2Due: { $sum: "$dues.secondTermDues" },
                    totalBusDue: { $sum: { $add: ["$dues.busfirstTermDues", "$dues.busSecondTermDues"] } }
                    // Add other dues fields here if you have them
                }
            },
            {
                $project: {
                    _id: 0,
                    totalOutstanding: {
                        $add: [
                            "$totalAdmissionDue",
                            "$totalTerm1Due",
                            "$totalTerm2Due",
                            "$totalBusDue"
                        ]
                    },
                    breakdown: {
                        admission: "$totalAdmissionDue",
                        term1: "$totalTerm1Due",
                        term2: "$totalTerm2Due",
                        transport: "$totalBusDue"
                    }
                }
            }
        ]);

        const result = stats[0] || { totalOutstanding: 0, breakdown: {} };

        res.status(200).json({ data: result, ok:true });

    } catch (error: any) {
        console.error("Outstanding Error:", error);
        res.status(500).json({ message: "Error fetching outstanding fees" , ok:false});
    }
};

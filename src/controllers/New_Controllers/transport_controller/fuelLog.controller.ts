import { type Response } from "express";
import { Types } from "mongoose"

import type { RoleBasedRequest } from "../../../utils/types.js";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import { FuelLogModel } from "../../../models/New_Model/transport_model/fuelLog.model.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import { resolveDateRange, type DateRangeType } from "./trasnportUtils.js";
import { BusModel } from "../../../models/New_Model/transport_model/bus.model.js";
import { DailyTripLogModel } from "../../../models/New_Model/transport_model/dailyTrip.model.js";

// 1. CREATE
export const createFuelLog = async (req: RoleBasedRequest, res: Response) => {
  try {
    const {
      schoolId,
      busId,
      date,
      odometerReading,
      fuelQuantity,
      pricePerLiter,
      totalAmount,
      fuelStation,
      paymentMode,
      fuelBillNo,
      notes,
    } = req.body;

    const enteredBy = req.user?._id;

    if (!schoolId) {
      return res.status(400).json({
        ok: false,
        message: "schoolId is required",
      });
    }
    if (!busId) {
      return res.status(400).json({
        ok: false,
        message: "busId is required",
      });
    }
    if (!date) {
      return res.status(400).json({
        ok: false,
        message: "date is required",
      });
    }
    if (fuelQuantity === undefined || fuelQuantity === null) {
      return res.status(400).json({
        ok: false,
        message: "fuelQuantity is required",
      });
    }

    const quantity = parseFloat(fuelQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        ok: false,
        message: "fuelQuantity must be a valid positive number",
      });
    }

    let computedTotal = totalAmount !== undefined ? parseFloat(totalAmount) : null;
    // const price = pricePerLiter !== undefined ? parseFloat(pricePerLiter) : null;

    // if (price !== null && !isNaN(price)) {
    //   computedTotal = parseFloat((quantity * price).toFixed(2));
    // }

    const school = await SchoolModel.findById(schoolId).lean();
    if (!school) {
      return res.status(404).json({
        ok: false,
        message: "School not found",
      });
    }

    const newLog = await FuelLogModel.create({
      schoolId,
      busId,
      date,
      enteredBy,
      odometerReading: odometerReading !== undefined ? parseFloat(odometerReading) : null,
      fuelQuantity: quantity,
      pricePerLiter: pricePerLiter || null,
      totalAmount: computedTotal,
      fuelStation: fuelStation || null,
      paymentMode: paymentMode || null,
      fuelBillNo: fuelBillNo || null,
      academicYear: school?.currentAcademicYear || null,
      notes: notes || null,
    });

    await createAuditLog(req, {
      action: "create",
      module: "fuelLog",
      targetId: newLog._id,
      description: `fuel log created (${newLog._id})`,
      status: "success",
    });

    return res.status(201).json({
      ok: true,
      message: "Fuel log created successfully",
      data: newLog,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to create fuel log",
    });
  }
};

// 2. UPDATE
export const updateFuelLog = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schoolId = req.body.schoolId;
    const {
      busId,
      date,
      odometerReading,
      fuelQuantity,
      pricePerLiter,
      totalAmount,
      fuelStation,
      paymentMode,
      fuelBillNo,
      notes,
    } = req.body;

    if (!schoolId) {
      return res.status(400).json({
        ok: false,
        message: "schoolId is required",
      });
    }

    const existingLog = await FuelLogModel.findOne({ _id: id, schoolId });

    if (!existingLog) {
      return res.status(404).json({
        ok: false,
        message: "Fuel log not found",
      });
    }

    const quantity =
      fuelQuantity !== undefined ? parseFloat(fuelQuantity) : existingLog.fuelQuantity;

    if (fuelQuantity !== undefined && (isNaN(quantity as number) || (quantity as number) <= 0)) {
      return res.status(400).json({
        ok: false,
        message: "fuelQuantity must be a valid positive number",
      });
    }

    const price =
      pricePerLiter !== undefined ? parseFloat(pricePerLiter) : existingLog.pricePerLiter;

    // let computedTotal =
    //   totalAmount !== undefined ? parseFloat(totalAmount) : existingLog.totalAmount;

    // if (price !== null && price !== undefined && !isNaN(price as number) && quantity) {
    //   computedTotal = parseFloat(((quantity as number) * (price as number)).toFixed(2));
    // }

    existingLog.busId = busId || existingLog.busId;
    existingLog.date = date || existingLog.date;
    existingLog.odometerReading =
      odometerReading !== undefined ? parseFloat(odometerReading) : existingLog.odometerReading;
    existingLog.fuelQuantity = quantity as number;
    existingLog.pricePerLiter = pricePerLiter as number;
    existingLog.totalAmount = totalAmount;
    existingLog.fuelStation = fuelStation !== undefined ? fuelStation : existingLog.fuelStation;
    existingLog.paymentMode = paymentMode !== undefined ? paymentMode : existingLog.paymentMode;
    existingLog.fuelBillNo = fuelBillNo !== undefined ? fuelBillNo : existingLog.fuelBillNo;
    existingLog.notes = notes !== undefined ? notes : existingLog.notes;

    await existingLog.save();

    await createAuditLog(req, {
      action: "update",
      module: "fuelLog",
      targetId: existingLog._id,
      description: `fuel log updated (${existingLog._id})`,
      status: "success",
    });

    return res.status(200).json({
      ok: true,
      message: "Fuel log updated successfully",
      data: existingLog,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to update fuel log",
    });
  }
};

// 3. GET ALL (paginated / infinite loading)
export const getAllFuelLogs = async (req: RoleBasedRequest, res: Response) => {
  try {
    // const { busId, academicYear, schoolId } = req.query;
    const {
      busId,
      academicYear,
      schoolId,
      search,
      fromDate,
      toDate,
      minAmount,
      maxAmount
    } = req.query;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    if (!schoolId) {
      return res.status(400).json({
        ok: false,
        message: "schoolId is required",
      });
    }

    const filter: Record<string, any> = { schoolId };
    if (busId) filter.busId = busId;
    if (academicYear) filter.academicYear = academicYear;

    // 3. Date Range Filter
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate as string);
      if (toDate) filter.date.$lte = new Date(toDate as string);
    }

    // 4. Amount Range Filter
    if (minAmount || maxAmount) {
      filter.totalAmount = {};
      if (minAmount) filter.totalAmount.$gte = Number(minAmount);
      if (maxAmount) filter.totalAmount.$lte = Number(maxAmount);
    }

    // 5. Global Search (Text + Odometer Number Match)
    if (search) {
      const searchString = String(search).trim();
      const searchRegex = new RegExp(searchString, "i");
      const searchNumber = Number(searchString); // Attempt to parse as number

      const orConditions: any[] = [
        { fuelStation: searchRegex },
        { fuelBillNo: searchRegex },
        { notes: searchRegex },
        { fuelLogNo: searchRegex }
      ];

      // If the user typed a valid number (e.g. "12500"), include odometer in the search
      if (!isNaN(searchNumber)) {
        orConditions.push({ odometerReading: searchNumber });
      }

      filter.$or = orConditions;
    }

    const [logs, total] = await Promise.all([
      FuelLogModel.find(filter)
        .populate("busId", "busNumber registrationNo _id")
        .populate("enteredBy", "name")
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FuelLogModel.countDocuments(filter),
    ]);

    const hasMore = skip + logs.length < total;

    return res.status(200).json({
      ok: true,
      message: "Fuel logs fetched successfully",
      data: logs,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to fetch fuel logs",
    });
  }
};

// 4. GET BY ID
export const getFuelLogById = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;
    // const schoolId = req.query.schoolId 

    // if (!schoolId) {
    //   return res.status(400).json({
    //     ok: false,
    //     message: "schoolId is required",
    //   });
    // }

    const log = await FuelLogModel.findOne({ _id: id })
      .populate("busId", "busNumber registrationNo")
      .populate("enteredBy", "name");

    if (!log) {
      return res.status(404).json({
        ok: false,
        message: "Fuel log not found",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Fuel log fetched successfully",
      data: log,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to fetch fuel log",
    });
  }
};

// 5. DELETE
export const deleteFuelLog = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;
    // const schoolId = req.query.schoolId || req.body.schoolId;

    // if (!schoolId) {
    //   return res.status(400).json({
    //     ok: false,
    //     message: "schoolId is required",
    //   });
    // }

    const log = await FuelLogModel.findOneAndDelete({ _id: id });

    if (!log) {
      return res.status(404).json({
        ok: false,
        message: "Fuel log not found",
      });
    }

    await archiveData({
      schoolId: log.schoolId,
      category: "fuelLog",
      originalId: log._id,
      deletedData: log.toObject(),
      deletedBy: req?.user?._id! || null,
      reason: req.body.reason || null,
    });

    await createAuditLog(req, {
      action: "delete",
      module: "fuelLog",
      targetId: log._id,
      description: `fuel log deleted (${log._id})`,
      status: "success",
    });

    return res.status(200).json({
      ok: true,
      message: "Fuel log deleted successfully",
      data: log,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to delete fuel log",
    });
  }
};





export const getFuelLogAnalytics = async (req: RoleBasedRequest, res: Response) => {
  try {
    const schoolId = req.params.schoolId
    if (!schoolId) {
      return res.status(400).json({ ok: false, message: "schoolId is required" });
    }

    const rangeType = (req.query.rangeType as DateRangeType) || "month";
    const customStart = req.query.startDate as string | undefined;
    const customEnd = req.query.endDate as string | undefined;

    let startDate: Date, endDate: Date;
    try {
      ({ startDate, endDate } = resolveDateRange(rangeType, customStart, customEnd));
    } catch (err: any) {
      return res.status(400).json({ ok: false, message: err.message });
    }

    const matchStage = {
      schoolId: new Types.ObjectId(schoolId),
      date: { $gte: startDate, $lte: endDate },
    };

    // ---- 1. Overall summary ----
    const [summary] = await FuelLogModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAmountSpent: { $sum: "$totalAmount" },
          totalFuelQuantity: { $sum: "$fuelQuantity" },
          totalFillUps: { $sum: 1 },
          // avgPricePerLiter: { $avg: "$pricePerLiter" },
          // maxSingleFillAmount: { $max: "$totalAmount" },
        },
      },
    ]);

    // ---- 2. Bus-wise fuel spend ----
    const busWiseBreakdown = await FuelLogModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$busId",
          totalAmountSpent: { $sum: "$totalAmount" },
          totalFuelQuantity: { $sum: "$fuelQuantity" },
          totalFillUps: { $sum: 1 },
          avgPricePerLiter: { $avg: "$pricePerLiter" },
        },
      },
      {
        $lookup: {
          from: BusModel.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "bus",
        },
      },
      { $unwind: { path: "$bus", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          busId: "$_id",
          busNumber: "$bus.busNumber",
          registrationNo: "$bus.registrationNo",
          totalAmountSpent: 1,
          totalFuelQuantity: 1,
          totalFillUps: 1,
          avgPricePerLiter: { $round: ["$avgPricePerLiter", 2] },
        },
      },
      { $sort: { totalAmountSpent: -1 } },
    ]);

    // ---- 3. Daily trend (spend + quantity, for chart) ----
    const dailyTrend = await FuelLogModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalAmountSpent: { $sum: "$totalAmount" },
          totalFuelQuantity: { $sum: "$fuelQuantity" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", totalAmountSpent: 1, totalFuelQuantity: 1 } },
    ]);

    // ---- 4. Fuel station-wise spend ----
    const stationWiseBreakdown = await FuelLogModel.aggregate([
      { $match: { ...matchStage, fuelStation: { $ne: null } } },
      {
        $group: {
          _id: "$fuelStation",
          totalAmountSpent: { $sum: "$totalAmount" },
          totalFillUps: { $sum: 1 },
        },
      },
      { $sort: { totalAmountSpent: -1 } },
      { $project: { _id: 0, fuelStation: "$_id", totalAmountSpent: 1, totalFillUps: 1 } },
    ]);

    // ---- 5. Payment mode breakdown ----
    const paymentModeBreakdown = await FuelLogModel.aggregate([
      { $match: { ...matchStage, paymentMode: { $ne: null } } },
      {
        $group: {
          _id: "$paymentMode",
          totalAmountSpent: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, paymentMode: "$_id", totalAmountSpent: 1, count: 1 } },
    ]);

    // ---- 6. Mileage (km/l) & cost-per-km per bus — joins trip logs ----
    const [tripStats, fuelStats] = await Promise.all([
      DailyTripLogModel.aggregate([
        { $match: matchStage },
        { $group: { _id: "$busId", totalKmRun: { $sum: "$kmRun" } } },
      ]),
      FuelLogModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$busId",
            totalFuelQuantity: { $sum: "$fuelQuantity" },
            totalAmountSpent: { $sum: "$totalAmount" },
          },
        },
      ]),
    ]);

    const tripMap = new Map(tripStats.map((t) => [String(t._id), t.totalKmRun]));
    const busIds = [...new Set(fuelStats.map((f) => String(f._id)))];
    const buses = await BusModel.find({ _id: { $in: busIds } }).select("busNumber registrationNo");
    const busMap = new Map(buses.map((b) => [String(b._id), b]));

    const mileageReport = fuelStats.map((f) => {
      const km = tripMap.get(String(f._id)) || 0;
      const litres = f.totalFuelQuantity || 0;
      const bus = busMap.get(String(f._id));
      return {
        busId: f._id,
        busNumber: bus?.busNumber || null,
        registrationNo: bus?.registrationNo || null,
        totalKmRun: km,
        totalFuelQuantity: litres,
        totalAmountSpent: f.totalAmountSpent,
        mileageKmPerLitre: litres > 0 ? +(km / litres).toFixed(2) : null,
        costPerKm: km > 0 ? +(f.totalAmountSpent / km).toFixed(2) : null,
      };
    }).sort((a, b) => (b.mileageKmPerLitre || 0) - (a.mileageKmPerLitre || 0));


    // --- 7. Calculate Monthly Averages (In-Memory) ---
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // Fallback to 1 to prevent infinity
    // const diffMonths = diffDays / 30.44; // Average days in a month

    const totalAmount = summary?.totalAmountSpent || 0;
    const totalQty = summary?.totalFuelQuantity || 0;

    // const avgMonthlyCost = diffMonths > 0 ? +(totalAmount / diffMonths).toFixed(2) : totalAmount;
    // const avgMonthlyConsumption = diffMonths > 0 ? +(totalQty / diffMonths).toFixed(2) : totalQty;


    // 2. Daily average — always meaningful regardless of range length
    const avgDailyCost = +(totalAmount / diffDays).toFixed(2);
    const avgDailyConsumption = +(totalQty / diffDays).toFixed(2);

    // 3. Projected month-end total — ONLY when viewing the current, still-in-progress month
    let projectedMonthEndCost: number | null = null;
    if (rangeType === "month") {
      const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
      projectedMonthEndCost = +(avgDailyCost * daysInMonth).toFixed(2);
    }

    return res.status(200).json({
      ok: true,
      data: {
        range: { rangeType, startDate, endDate },
        // summary: {...summary, avgMonthlyCost, avgMonthlyConsumption} || {
        //   totalAmountSpent: 0,
        //   totalFuelQuantity: 0,
        //   totalFillUps: 0,
        //   avgPricePerLiter: 0,
        //   maxSingleFillAmount: 0,

        // },

        summary: {
          totalAmountSpent: totalAmount,
          totalFuelQuantity: totalQty,
          totalFillUps: summary?.totalFillUps || 0,
          avgDailyCost,
          avgDailyConsumption,
          projectedMonthEndCost, // null unless rangeType === "month"
          // avgPricePerLiter: summary.avgPricePerLiter || 0,
          // maxSingleFillAmount: summary.maxSingleFillAmount || 0,
        },
        busWiseBreakdown,
        dailyTrend,
        stationWiseBreakdown,
        paymentModeBreakdown,
        mileageReport,
      },
    });
  } catch (error: any) {
    console.error("getFuelLogAnalytics error:", error);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
};
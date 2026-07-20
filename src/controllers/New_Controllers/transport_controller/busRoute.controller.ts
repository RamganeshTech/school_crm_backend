import type { Response } from "express";
import type { RoleBasedRequest } from "../../../utils/types.js";
import BusRouteModel from "../../../models/New_Model/transport_model/busRoute.model.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import mongoose from "mongoose";

export const createBusRoute = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { routeName, stops, feeAmount, feeFrequency, schoolId } = req.body;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }
        if (!routeName) {
            return res.status(400).json({ ok: false, message: "routeName is required" });
        }
        if (!Array.isArray(stops) || stops.length === 0) {
            return res.status(400).json({ ok: false, message: "At least one stop is required" });
        }
        for (const stop of stops) {
            if (!stop.stopName) {
                return res.status(400).json({ ok: false, message: "Each stop must have a stopName" });
            }
        }

        const route = new BusRouteModel({
            schoolId,
            routeName,
            stops,
            feeAmount,
            feeFrequency,
        });

        await route.save();

        await createAuditLog(req, {
            action: "CREATE",
            module: "BusRoute",
            targetId: route._id,
            //   performedBy: req.user?._id,
            description: `Route ${route.routeNo} created`,
            status: "success"
        });

        return res.status(201).json({ ok: true, data: route });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};



export const addBusRouteAssignment = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { routeId } = req.params;
        const { schoolId, assignments } = req.body;
        // assignments expected as: [{ busId, driverId, shift, stopTimings: [{ stopName, time }] }, ...]

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }
        if (!routeId) {
            return res.status(400).json({ ok: false, message: "routeId is required" });
        }
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ ok: false, message: "assignments array is required" });
        }

        const route = await BusRouteModel.findOne({ _id: routeId, schoolId });
        if (!route) {
            return res.status(404).json({ ok: false, message: "Route not found" });
        }

        const stopMap = new Map(route.stops.map((s: any) => [s.stopName, s._id]));

        const unresolvedStops: string[] = [];
        const newAssignments: any[] = [];

        assignments.forEach((assignment: any, index: number) => {
            const { busId, driverId, shift, stopTimings } = assignment;

            if (!busId || !driverId || !shift) {
                unresolvedStops.push(`assignment[${index}]: busId, driverId and shift are required`);
                return;
            }
            if (!Array.isArray(stopTimings) || stopTimings.length === 0) {
                unresolvedStops.push(`assignment[${index}]: stopTimings are required`);
                return;
            }

            const resolvedTimings: any[] = [];
            for (const entry of stopTimings) {
                const stopId = stopMap.get(entry.stopName);
                if (!stopId) {
                    unresolvedStops.push(`assignment[${index}]: stop "${entry.stopName}" not found in this route`);
                    continue;
                }
                // resolvedTimings.push({ stopId, time: entry.time });

                // FIX: Now saving stopName alongside stopId and time!
                resolvedTimings.push({ 
                    stopId, 
                    stopName: entry.stopName, 
                    time: entry.time 
                });
            }

            newAssignments.push({
                busId,
                driverId, 
                shift,
                stopTimings: resolvedTimings,
                isActive: true,
            });
        });

        if (unresolvedStops.length > 0) {
            return res.status(400).json({ ok: false, message: unresolvedStops.join("; ") });
        }

        route.assignments.push(...newAssignments);

        await route.save();

        await createAuditLog(req, {
            action: "UPDATE",
            module: "BusRoute",
            targetId: route._id,
            description: `${newAssignments.length} assignment(s) added to route ${route.routeNo}`,
            status: "success",
        });

        return res.status(200).json({ ok: true, data: route });
    } catch (error: any) {
        console.log("erro from the add bus route assignment", error.message);
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const updateBusRouteAssignment = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { routeId } = req.params;
    const { schoolId, assignmentId, busId, driverId, shift, stopTimings } = req.body;
    // stopTimings expected as: [{ stopName, time }]

    if (!schoolId) {
      return res.status(400).json({ ok: false, message: "schoolId is required" });
    }
    if (!routeId) {
      return res.status(400).json({ ok: false, message: "routeId is required" });
    }
    if (!assignmentId) {
      return res.status(400).json({ ok: false, message: "assignmentId is required" });
    }

    const route = await BusRouteModel.findOne({ _id: routeId, schoolId });
    if (!route) {
      return res.status(404).json({ ok: false, message: "Route not found" });
    }

    const assignment = route.assignments.find(
      (a: any) => a._id.toString() === assignmentId
    ) as any;

    if (!assignment) {
      return res.status(404).json({ ok: false, message: "Assignment not found in this route" });
    }

    if (busId !== undefined) assignment.busId = busId;
    if (driverId !== undefined) assignment.driverId = driverId;
    if (shift !== undefined) assignment.shift = shift;

    if (stopTimings !== undefined) {
      if (!Array.isArray(stopTimings) || stopTimings.length === 0) {
        return res.status(400).json({ ok: false, message: "stopTimings must be a non-empty array" });
      }

      const stopMap = new Map(route.stops.map((s: any) => [s.stopName, s._id]));
      const unresolved: string[] = [];
      const resolvedTimings: any[] = [];

      for (const entry of stopTimings) {
        const stopId = stopMap.get(entry.stopName);
        if (!stopId) {
          unresolved.push(entry.stopName);
          continue;
        }
        resolvedTimings.push({
          stopId,
          stopName: entry.stopName,
          time: entry.time,
        });
      }

      if (unresolved.length > 0) {
        return res.status(400).json({
          ok: false,
          message: `Stops not found in this route: ${unresolved.join(", ")}`,
        });
      }

      assignment.stopTimings = resolvedTimings;
    }

    await route.save();

    await createAuditLog(req, {
      action: "UPDATE",
      module: "BusRoute",
      targetId: route._id,
      description: `Assignment ${assignmentId} updated on route ${route.routeNo}`,
      status: "success",
    });

    return res.status(200).json({ ok: true, data: route });
  } catch (error: any) {
    console.log("error from the update bus route assignment", error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
};

export const removeBusRouteAssignment = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { routeId } = req.params;
    const { schoolId, assignmentId } = req.body;

    if (!schoolId) {
      return res.status(400).json({ ok: false, message: "schoolId is required" });
    }
    if (!routeId) {
      return res.status(400).json({ ok: false, message: "routeId is required" });
    }
    if (!assignmentId) {
      return res.status(400).json({ ok: false, message: "assignmentId is required" });
    }

    const route = await BusRouteModel.findOne({ _id: routeId, schoolId });
    if (!route) {
      return res.status(404).json({ ok: false, message: "Route not found" });
    }

    const assignmentExists = route.assignments.some(
      (a: any) => a._id.toString() === assignmentId
    );

    if (!assignmentExists) {
      return res.status(404).json({ ok: false, message: "Assignment not found in this route" });
    }

    route.assignments = route.assignments.filter(
      (a: any) => a._id.toString() !== assignmentId
    ) as any;

    await route.save();

    await createAuditLog(req, {
      action: "UPDATE",
      module: "BusRoute",
      targetId: route._id,
      description: `Assignment ${assignmentId} removed from route ${route.routeNo}`,
      status: "success",
    });

    return res.status(200).json({ ok: true, data: route });
  } catch (error: any) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};



export const updateBusRoute = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { routeId } = req.params;
        const { schoolId, routeName, stops, feeAmount, feeFrequency } = req.body;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }
        if (!routeId) {
            return res.status(400).json({ ok: false, message: "routeId is required" });
        }

        const route = await BusRouteModel.findOne({ _id: routeId, schoolId });
        if (!route) {
            return res.status(404).json({ ok: false, message: "Route not found" });
        }

        if (routeName !== undefined) route.routeName = routeName;
        if (feeAmount !== undefined) route.feeAmount = feeAmount;
        if (feeFrequency !== undefined) route.feeFrequency = feeFrequency;

        if (stops !== undefined) {
            if (!Array.isArray(stops) || stops.length === 0) {
                return res.status(400).json({ ok: false, message: "stops must be a non-empty array" });
            }
            for (const stop of stops) {
                if (!stop.stopName) {
                    return res.status(400).json({ ok: false, message: "Each stop must have a stopName" });
                }
            }
            route.stops = stops as any;
            // note: existing assignments reference old stop _ids via stopTimings.
            // if stops are replaced, those references may go stale — flagging below.
        }

        await route.save();

        await createAuditLog(req, {
            action: "UPDATE",
            module: "BusRoute",
            targetId: route._id,
            description: `Route ${route.routeNo} details updated`,
            status: "success",
        });

        return res.status(200).json({ ok: true, data: route, stopsReplaced: stops !== undefined });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const getAllBusRoutes = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { search, minFee, maxFee, limit = "20", schoolId, page } = req.query;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        
        const currentPage = parseInt(page as string) || 1;
        const pageLimit = parseInt(limit as string, 10) || 20;
        const skip = (page - 1) * parseInt(limit);

        const filter: any = { schoolId };

        if (search) {
            const regex = new RegExp(search as string, "i");
            filter.$or = [{ routeNo: regex }, { routeName: regex }];
        }

        if (minFee || maxFee) {
            filter.feeAmount = {};
            if (minFee) filter.feeAmount.$gte = Number(minFee);
            if (maxFee) filter.feeAmount.$lte = Number(maxFee);
        }

       
        const [burRoutes, total] = await Promise.all([
            BusRouteModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            BusRouteModel.countDocuments(filter),
        ]);

        const hasMore = skip +  burRoutes.length < total;

     
        return res.status(200).json({
            ok: true,
            data: burRoutes,
            pagination: {

                page: currentPage,
                limit: pageLimit,
                total,
                hasMore,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const getAllBusRoutesDropDown = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {  schoolId } = req.params;

        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" });
        }

        const filter: any = { schoolId };

        const burRoutes = await BusRouteModel.find(filter)
                .sort({ createdAt: -1 })
                .select("_id routeName routeNo schoolId feeAmount")
     
        return res.status(200).json({
            ok: true,
            data: burRoutes
        });

    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


export const getSingleBusRoute = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { routeId } = req.params;

    if (!routeId) {
      return res.status(400).json({ ok: false, message: "routeId is required" });
    }

    const route = await BusRouteModel.findOne({ _id: routeId })
      .populate({ path: "assignments.busId", select: "_id busNumber registrationNo" })
      .populate({ path: "assignments.driverId", select: "_id name" })
      .lean();

    if (!route) {
      return res.status(404).json({ ok: false, message: "Route not found" });
    }

    return res.status(200).json({ ok: true, data: route });
  } catch (error: any) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};


export const getAssignedRoutesForDriver = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { driverId } = req.params;

        // 1. Validate the provided driverId
        if (!driverId || !mongoose.Types.ObjectId.isValid(driverId)) {
            return res.status(400).json({ 
                ok: false, 
                message: "A valid Driver ID is required." 
            });
        }

        // 2. Query routes where this driver is found in the assignments array
        const routes = await BusRouteModel.find({
            "assignments.driverId": driverId,
            isActive: true 
        })
        .populate("assignments.busId", "_id busNumber registrationNo capacity assignedDriverId") // Optional: populate bus details if you want to show which bus they are driving
        .lean(); // Use lean() for faster read-only execution

        if (!routes || routes.length === 0) {
            return res.status(200).json({ 
                ok: true, 
                message: "No active routes assigned to this driver.", 
                data: [] 
            });
        }

        // 3. Filter the assignments array to ONLY include the assignments for this specific driver
        const formattedRoutes = routes.map((route: any) => {
            return {
                ...route,
                // Keep only the assignments that match the requested driver
                assignments: route.assignments.filter(
                    (assignment: any) => String(assignment.driverId) === String(driverId)
                )
            };
        });

        // 4. Return the successfully formatted data
        return res.status(200).json({
            ok: true,
            message: "Assigned routes fetched successfully.",
            data: formattedRoutes
        });

    } catch (error: any) {
        console.error("Error fetching assigned routes for driver:", error);
        return res.status(500).json({ 
            ok: false, 
            message: error.message || "Failed to fetch assigned routes." 
        });
    }
};

export const deleteBusRoute = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { routeId } = req.params;


        if (!routeId) {
            return res.status(400).json({ ok: false, message: "routeId is required" });
        }

        const route = await BusRouteModel.findOneAndDelete({ _id: routeId });

        if (!route) {
            return res.status(404).json({ ok: false, message: "Route not found" });
        }

        await createAuditLog(req, {
            action: "DELETE",
            module: "BusRoute",
            targetId: route._id,
            description: `Route ${route.routeNo} deleted`,
            status: "success",
        });

        // 2. CALL THE ARCHIVE UTILITY
        await archiveData({
            schoolId: route.schoolId,
            category: "bus route",
            originalId: route._id,
            deletedData: route.toObject(), // Convert Mongoose doc to plain object
            deletedBy: req?.user?._id! || null,
            reason: null, // Optional reason from body
        });

        return res.status(200).json({ ok: true, message: "Route deleted successfully" });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};
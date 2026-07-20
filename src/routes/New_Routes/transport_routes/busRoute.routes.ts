import { Router } from "express";
import { multiRoleAuth } from "../../../middleware/multiRoleRequest.js";
import {  createBusRoute,
 addBusRouteAssignment,
 getAllBusRoutes,
 getSingleBusRoute,
 updateBusRoute,
 deleteBusRoute,
 getAllBusRoutesDropDown,
 removeBusRouteAssignment,
 updateBusRouteAssignment,
 getAssignedRoutesForDriver, } from "../../../controllers/New_Controllers/transport_controller/busRoute.controller.js";

const busStoprouter = Router();

// Create route (routeName + stops, feeAmount, feeFrequency)
busStoprouter.post("/", multiRoleAuth("correspondent", "administrator"), createBusRoute);

// Add assignments in bulk (busId, driverId, shift, stopTimings per assignment)
busStoprouter.post("/:routeId/assignments", multiRoleAuth("correspondent", "administrator"), addBusRouteAssignment);
busStoprouter.delete("/:routeId/assignments", multiRoleAuth("correspondent", "administrator"), removeBusRouteAssignment);
busStoprouter.put("/:routeId/assignments", multiRoleAuth("correspondent", "administrator"), updateBusRouteAssignment);


// Get all - search (routeNo/routeName) + minFee/maxFee + cursor pagination
busStoprouter.get("/", multiRoleAuth("correspondent", "administrator", "principal"), getAllBusRoutes);
busStoprouter.get("/drop-down/:schoolId",multiRoleAuth("correspondent", "administrator", "principal"), getAllBusRoutesDropDown);
busStoprouter.get("/assigned-routes/:driverId",multiRoleAuth("correspondent", "administrator", "principal"), getAssignedRoutesForDriver);


// Get single route
busStoprouter.get("/:routeId",multiRoleAuth("correspondent", "administrator", "principal"), getSingleBusRoute);

// Update route details (routeName, stops, feeAmount, feeFrequency)
busStoprouter.put("/:routeId", multiRoleAuth("correspondent", "administrator"),updateBusRoute);

// Delete route
busStoprouter.delete("/:routeId", multiRoleAuth("correspondent", "administrator"), deleteBusRoute);

export default busStoprouter;
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import UserModel from "../models/New_Model/UserModel/userModel.model.js";
import dotenv from 'dotenv';

dotenv.config();

let io: Server;

export const initSocket = (server: any) => {
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    console.log("🔌 Socket.io Server Initialized");

    // --- SOCKET AUTHENTICATION MIDDLEWARE ---
    io.use(async (socket: Socket, next) => {
        try {
            const cookieString = socket.handshake.headers.cookie;

            if (!cookieString) {
                console.log(`❌ [SOCKET AUTH REJECTED] No cookies found for socket ${socket.id}`);
                return next(new Error("Authentication error: No cookies provided"));
            }

            const getCookie = (name: string) => {
                const match = cookieString.match(new RegExp('(^| )' + name + '=([^;]+)'));
                if (match) return match[2];
                return null;
            };

            const token = getCookie("token"); 

            if (!token) {
                console.log(`❌ [SOCKET AUTH REJECTED] Token cookie missing for socket ${socket.id}`);
                return next(new Error("Authentication error: Token cookie missing"));
            }

            // Verify Token safely
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
            
            // FIX 1: Support both token formats ('id' or '_id') safely
            const userId = decoded.id || decoded._id;

            if (!userId) {
                console.log(`❌ [SOCKET AUTH REJECTED] No valid user ID found inside JWT payload`);
                return next(new Error("Authentication error: Invalid payload"));
            }

            // FIX 2: Project BOTH schoolId and role from the database
            const user = await UserModel.findById(userId).select('schoolId role');

            if (!user || !user.schoolId) {
                console.log(`❌ [SOCKET AUTH REJECTED] User document not found or schoolId is missing for ID: ${userId}`);
                return next(new Error("User or School not found"));
            }

            // FIX 3: Robust string parsing if schoolId is an object or populated reference
            const schoolIdString = typeof user.schoolId === 'object' && (user.schoolId as any)._id
                ? (user.schoolId as any)._id.toString()
                : user.schoolId.toString();

            // Attach validated user info securely to the active socket instance
            (socket as any).user = {
                id: user._id.toString(),
                schoolId: schoolIdString,
                role: user.role || 'parent'
            };

            next();
        } catch (error: any) {
            console.log(`💥 [SOCKET AUTH ERROR] Failed verification for socket ${socket.id}. Error:`, error.message);
            next(new Error("Authentication error"));
        }
    });

    // --- CONNECTION HANDLER ---
    io.on("connection", (socket: Socket) => {
        const userId = (socket as any).user.id;
        const schoolId = (socket as any).user.schoolId;
        const role = (socket as any).user.role;

        console.log(`\n✅ [SOCKET CONNECTED] Socket ID: ${socket.id}`);
        console.log(`   👤 User ID: ${userId} (${role})`);

        // Join the user to their specific school room matrix
        socket.join(schoolId);

        console.log(`   ¼¶ [ROOM JOINED] Successfully joined School Room: -> [${schoolId}] <-`);
        console.log(`   📊 Total active connections in room [${schoolId}]:`, io.sockets.adapter.rooms.get(schoolId)?.size || 0);

        socket.on("disconnect", (reason) => {
            console.log(`\n❌ [SOCKET DISCONNECTED] Socket ID: ${socket.id}`);
            console.log(`   👤 User ID: ${userId}`);
            console.log(`   ⚠️ Reason: ${reason}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) throw new Error("Socket.io is not initialized!");
    return io;
};
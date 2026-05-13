// import jwt from "jsonwebtoken";

// export const multiRoleAuth = (...allowedRoles) => {
//     return async (req, res, next) => {
//         try {
//             // 1. Get the token from the Header
//             const authHeader = req.headers.authorization;

//             console.log("req.headers.authorization", req.headers.authorization)
//             console.log(" --------------")

//             console.log("headers", authHeader)

//             let token;
//             if (authHeader && authHeader.startsWith("Bearer")) {
//                 token = authHeader.split(" ")[1];
//             }

//             // If no token found
//             if (!token) {
//                 return res.status(401).json({
//                     message: "Unauthorized: No token provided",
//                     ok: false
//                 });
//             }

//             // 2. Verify the Token
//             const decoded = jwt.verify(token, process.env.JWT_SECRET!);

//             // 3. Check if User exists in DB 
//             // (Crucial: prevents access if a teacher was fired/deleted but token is still valid)
//             // const user = await UserModel.findById(decoded.id).select("-password");

//             // if (!user) {
//             //     return res.status(401).json({
//             //         message: "Unauthorized: User no longer exists",
//             //         ok: false
//             //     });
//             // }

//             // 4. Role Validation
//             // We check if the user's role (from DB) is in the allowed list passed to the function
//             if (!allowedRoles.includes(decoded.role)) {
//                 return res.status(403).json({
//                     message: `Access denied: Role '${decoded.role}' is not authorized.`,
//                     ok: false
//                 });
//             }


//             console.log(" --------------")
//             console.log("decoded", decoded)
//             // 5. Attach User to Request
//             // Now controllers can access req.user.schoolId, req.user._id, etc.
//             req.user = {
//                 _id: decoded._id,
//                 schoolId: decoded.schoolId,
//                 role: decoded.role,
//                 isPlatformAdmin: decoded.isPlatformAdmin,
//             };

//             next();

//         } catch (error:any) {
//             console.error("Auth Middleware Error:", error.message);
//             return res.status(401).json({
//                 message: "Authentication failed: Invalid or expired token",
//                 ok: false
//             });
//         }
//     };
// };


// SECOND VERSION
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { RoleBasedRequest, UserPayload } from '../utils/types.js';

export const multiRoleAuth = (...allowedRoles: string[]) => {
    return async (req: RoleBasedRequest, res: Response, next: NextFunction) => {
        // 1. Extract BOTH potential tokens
        const authHeader = req.headers.authorization;
        const headerToken = (authHeader && authHeader.startsWith("Bearer"))
            ? authHeader.split(" ")[1]
            : null;

        const cookieToken = req.cookies?.token || null;

        // If absolutely no tokens are provided
        if (!headerToken && !cookieToken) {
            return res.status(401).json({
                message: "Unauthorized: No token provided",
                ok: false
            });
        }

        let decoded: UserPayload | null = null;

        // 2. Try the Header Token first (Mobile App Priority)
        if (headerToken) {
            try {
                decoded = jwt.verify(headerToken, process.env.JWT_SECRET!) as UserPayload;
            } catch (err) {
                // DON'T return 401 yet. Just log it and let it fall through to the cookie check.
                console.warn("Header token verification failed, attempting cookie fallback...", err);
            }
        }

        // 3. Fallback to the Cookie Token (Web App)
        // If decoded is still null (either header didn't exist, or header threw an error)
        if (!decoded && cookieToken) {
            try {
                decoded = jwt.verify(cookieToken, process.env.JWT_SECRET!) as UserPayload;
            } catch (err) {
                // If this fails too, then both are truly invalid
                console.warn("Cookie token verification failed.", err);
            }
        }

        // 4. Final verification check
        if (!decoded) {
            return res.status(401).json({
                message: "Authentication failed: Tokens are invalid or expired",
                ok: false
            });
        }

        // 5. Role Validation
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).json({
                message: `Access denied: Role '${decoded.role}' is not authorized.`,
                ok: false
            });
        }

        // 6. Attach User to Request
        req.user = {
            _id: decoded._id,
            schoolId: decoded.schoolId,
            role: decoded.role,
            isPlatformAdmin: decoded.isPlatformAdmin,
        };

        next();
    };
};
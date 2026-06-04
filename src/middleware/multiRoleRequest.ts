

// SECOND VERSION
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { RoleBasedRequest, UserPayload } from '../utils/types.js';

type UserRole = "correspondent" | "teacher" | "principal" | "viceprincipal" | "administrator" | "parent" | "accountant" ;


export const multiRoleAuth = (...allowedRoles: UserRole[]) => {
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
        if (!allowedRoles.includes(decoded.role as UserRole)) {
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
            userName: decoded?.userName
        };

        next();
    };
};
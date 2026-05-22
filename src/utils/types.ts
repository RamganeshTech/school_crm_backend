import { type Request } from 'express';
import { type JwtPayload } from 'jsonwebtoken';

// 1. The specific data inside your JWT
export interface UserPayload extends JwtPayload {
    _id: string;
    schoolId: string;
    role: string;
    isPlatformAdmin: boolean;
    userName: string
}

// 2. The extended Request type you'll use in controllers
export interface RoleBasedRequest extends Request {
    user?: UserPayload;
    params: any;
    query: any;
    body: any;
}
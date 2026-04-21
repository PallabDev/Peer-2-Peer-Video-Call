import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "../../db/db-connect";
import { usersTable } from "../../db/schema";
import { ACCESS_STATUS, USER_ROLES } from "../constants/user";
import type { AuthenticatedRequest } from "../types/auth";
import { ApiError } from "../utils/ApiErrors";
import { verifyAccessToken } from "../utils/jwt";
import { safeUserSelect } from "../utils/safe-user";

const getTokenFromHeaders = (req: Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        throw new ApiError(401, "Authorization token is missing.");
    }

    return authHeader.slice("Bearer ".length);
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const token = getTokenFromHeaders(req);
        const payload = verifyAccessToken(token);
        const [user] = await db.select(safeUserSelect).from(usersTable).where(eq(usersTable.id, payload.sub));

        if (!user) {
            throw new ApiError(401, "User session is invalid.");
        }

        (req as AuthenticatedRequest).user = user;
        next();
    } catch (error) {
        next(error);
    }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || user.role !== USER_ROLES.ADMIN) {
        return next(new ApiError(403, "Admin access is required."));
    }

    next();
};

export const requireCallAccess = (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
        return next(new ApiError(401, "Unauthorized."));
    }

    if (!user.emailVerified) {
        return next(new ApiError(403, "Verify your email to continue."));
    }

    if (user.role !== USER_ROLES.ADMIN && user.accessStatus !== ACCESS_STATUS.APPROVED) {
        return next(new ApiError(403, "Access denied. Wait for admin approval."));
    }

    next();
};

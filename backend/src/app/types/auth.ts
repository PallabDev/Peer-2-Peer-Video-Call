import type { Request } from "express";

export type SafeUser = {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    role: "admin" | "user";
    accessStatus: "pending" | "approved" | "denied";
    emailVerified: boolean;
    expoPushToken: string | null;
    approvedAt: Date | null;
    createdAt: Date;
};

export type AuthenticatedRequest = Request & {
    user: SafeUser;
};

export type JwtPayload = {
    sub: string;
    role: SafeUser["role"];
    accessStatus: SafeUser["accessStatus"];
    email: string;
};

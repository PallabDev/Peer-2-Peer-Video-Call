import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { JwtPayload, SafeUser } from "../types/auth";

export const signAccessToken = (user: SafeUser) => {
    return jwt.sign(
        {
            role: user.role,
            accessStatus: user.accessStatus,
            email: user.email,
        },
        env.JWT_SECRET,
        {
            subject: user.id,
            expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
        },
    );
};

export const verifyAccessToken = (token: string) => {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload & jwt.JwtPayload;
};

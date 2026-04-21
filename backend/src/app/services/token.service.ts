import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";

export const generateOpaqueToken = () => randomBytes(32).toString("hex");

export const hashOpaqueToken = (token: string) => {
    return createHash("sha256").update(token).digest("hex");
};

export const buildEmailVerificationLink = (token: string) => {
    const baseUrl = env.BACKEND_PUBLIC_URL.replace(/\/+$/, "");
    return `${baseUrl}/api/auth/verify-email/redirect?token=${token}`;
};

export const buildResetPasswordLink = (token: string) => {
    const baseUrl = env.BACKEND_PUBLIC_URL.replace(/\/+$/, "");
    return `${baseUrl}/api/auth/reset-password/redirect?token=${token}`;
};

export const buildAppVerifyLink = (token: string) => {
    return `${env.APP_SCHEME}://verify-email?token=${token}`;
};

export const buildAppResetLink = (token: string) => {
    return `${env.APP_SCHEME}://reset-password?token=${token}`;
};

import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiErrors";
import type { AuthenticatedRequest } from "../types/auth";
import {
    createPasswordResetToken,
    createUser,
    createVerificationToken,
    getUserByEmail,
    loginUser,
    resetPasswordWithToken,
    verifyEmailToken,
} from "../services/auth.service";
import {
    forgotPasswordSchema,
    loginSchema,
    registerSchema,
    resendVerificationSchema,
    resetPasswordSchema,
    verifyEmailSchema,
} from "../validators/auth.validator";
import { buildAppResetLink, buildAppVerifyLink } from "../services/token.service";
import { signAccessToken } from "../utils/jwt";

export const register = async (req: AuthenticatedRequest, res: Response) => {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
        throw new ApiError(400, "Invalid registration payload.", result.error.flatten());
    }

    const user = await createUser(result.data);
    return res.status(201).json(new ApiResponse(201, "Account created. Please verify your email.", user));
};

export const login = async (req: AuthenticatedRequest, res: Response) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
        throw new ApiError(400, "Invalid login payload.", result.error.flatten());
    }

    const user = await loginUser(result.data.email, result.data.password);
    const token = signAccessToken(user);
    return res.status(200).json(new ApiResponse(200, "Login successful.", { token, user }));
};

export const verifyEmail = async (req: AuthenticatedRequest, res: Response) => {
    const result = verifyEmailSchema.safeParse(req.body);
    if (!result.success) {
        throw new ApiError(400, "Invalid verification payload.", result.error.flatten());
    }

    await verifyEmailToken(result.data.token);
    return res.status(200).json(new ApiResponse(200, "Email verified successfully."));
};

export const resendVerification = async (req: AuthenticatedRequest, res: Response) => {
    const result = resendVerificationSchema.safeParse(req.body);
    if (!result.success) {
        throw new ApiError(400, "Invalid request.", result.error.flatten());
    }

    const user = await getUserByEmail(result.data.email);
    if (user) {
        await createVerificationToken(user.id, user.email, user.firstName);
    }

    return res.status(200).json(new ApiResponse(200, "If the account exists, a verification email has been sent."));
};

export const forgotPassword = async (req: AuthenticatedRequest, res: Response) => {
    const result = forgotPasswordSchema.safeParse(req.body);
    if (!result.success) {
        throw new ApiError(400, "Invalid request.", result.error.flatten());
    }

    const user = await getUserByEmail(result.data.email);
    if (user) {
        await createPasswordResetToken(user.id, user.email, user.firstName);
    }

    return res.status(200).json(new ApiResponse(200, "If the account exists, a password reset email has been sent."));
};

export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
    const result = resetPasswordSchema.safeParse(req.body);
    if (!result.success) {
        throw new ApiError(400, "Invalid request.", result.error.flatten());
    }

    await resetPasswordWithToken(result.data.token, result.data.password);
    return res.status(200).json(new ApiResponse(200, "Password updated successfully."));
};

export const me = async (req: AuthenticatedRequest, res: Response) => {
    return res.status(200).json(new ApiResponse(200, "Current user fetched successfully.", req.user));
};

export const verifyEmailRedirect = async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
        throw new ApiError(400, "Verification token is required.");
    }

    return res.redirect(buildAppVerifyLink(token));
};

export const resetPasswordRedirect = async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
        throw new ApiError(400, "Reset token is required.");
    }

    return res.redirect(buildAppResetLink(token));
};

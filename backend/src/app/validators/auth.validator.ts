import { z } from "zod";

export const registerSchema = z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().max(80).optional().or(z.literal("")),
    email: z.string().trim().email().max(322),
    password: z.string().min(8).max(128)
        .regex(/[A-Z]/, "Password must contain an uppercase letter.")
        .regex(/[a-z]/, "Password must contain a lowercase letter.")
        .regex(/[0-9]/, "Password must contain a number."),
});

export const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
});

export const verifyEmailSchema = z.object({
    token: z.string().min(16),
});

export const forgotPasswordSchema = z.object({
    email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(16),
    password: z.string().min(8).max(128)
        .regex(/[A-Z]/, "Password must contain an uppercase letter.")
        .regex(/[a-z]/, "Password must contain a lowercase letter.")
        .regex(/[0-9]/, "Password must contain a number."),
});

export const resendVerificationSchema = z.object({
    email: z.string().trim().email(),
});

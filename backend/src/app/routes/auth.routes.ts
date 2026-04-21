import { Router } from "express";
import {
    forgotPassword,
    login,
    me,
    register,
    resendVerification,
    resetPassword,
    resetPasswordRedirect,
    verifyEmail,
    verifyEmailRedirect,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get("/verify-email/redirect", asyncHandler(verifyEmailRedirect));
router.get("/reset-password/redirect", asyncHandler(resetPasswordRedirect));
router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/verify-email", asyncHandler(verifyEmail));
router.post("/resend-verification", asyncHandler(resendVerification));
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post("/reset-password", asyncHandler(resetPassword));
router.get("/me", requireAuth, asyncHandler(me));

export default router;

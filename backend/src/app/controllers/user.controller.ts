import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import { listApprovedContacts, savePushToken } from "../services/auth.service";
import { getRecentCallsForUser } from "../services/call.service";
import { ApiError } from "../utils/ApiErrors";
import { ApiResponse } from "../utils/ApiResponse";
import { savePushTokenSchema } from "../validators/user.validator";

export const getContacts = async (req: AuthenticatedRequest, res: Response) => {
    const users = await listApprovedContacts(req.user.id);
    return res.status(200).json(new ApiResponse(200, "Contacts fetched successfully.", users));
};

export const registerPushToken = async (req: AuthenticatedRequest, res: Response) => {
    const result = savePushTokenSchema.safeParse(req.body);
    if (!result.success) {
        throw new ApiError(400, "Invalid push token payload.", result.error.flatten());
    }

    const user = await savePushToken(req.user.id, result.data.expoPushToken);
    return res.status(200).json(new ApiResponse(200, "Push token saved successfully.", user));
};

export const getCallHistory = async (req: AuthenticatedRequest, res: Response) => {
    const calls = await getRecentCallsForUser(req.user.id);
    return res.status(200).json(new ApiResponse(200, "Call history fetched successfully.", calls));
};

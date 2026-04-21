import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiErrors";
import { listUsersForAdmin, updateUserAccessAndRole } from "../services/auth.service";
import { updateUserSchema } from "../validators/admin.validator";

export const getUsers = async (_req: AuthenticatedRequest, res: Response) => {
    const users = await listUsersForAdmin();
    return res.status(200).json(new ApiResponse(200, "Users fetched successfully.", users));
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
    const result = updateUserSchema.safeParse(req.body);
    if (!result.success) {
        throw new ApiError(400, "Invalid update payload.", result.error.flatten());
    }

    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    if (!userId) {
        throw new ApiError(400, "User id is required.");
    }

    const updatedUser = await updateUserAccessAndRole(userId, req.user.id, result.data);
    return res.status(200).json(new ApiResponse(200, "User updated successfully.", updatedUser));
};

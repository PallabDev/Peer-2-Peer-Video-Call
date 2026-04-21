import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import { getRecentCallsForUser } from "../services/call.service";
import { ApiResponse } from "../utils/ApiResponse";

export const getCalls = async (req: AuthenticatedRequest, res: Response) => {
    const calls = await getRecentCallsForUser(req.user.id);
    return res.status(200).json(new ApiResponse(200, "Calls fetched successfully.", calls));
};

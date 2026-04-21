import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiErrors";

export const customError = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors,
        });
    }

    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({
        success: false,
        message,
    });
};

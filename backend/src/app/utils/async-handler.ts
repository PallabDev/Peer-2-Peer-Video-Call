import type { NextFunction, Request, Response } from "express";

export const asyncHandler = <
    TRequest extends Request = Request,
    TResponse extends Response = Response,
>(
    handler: (req: TRequest, res: TResponse, next: NextFunction) => Promise<unknown>,
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(handler(req as TRequest, res as TResponse, next)).catch(next);
    };
};

import cors from "cors";
import express, { type Express, type Response } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import userRoutes from "./routes/user.routes";
import callRoutes from "./routes/call.routes";
import { customError } from "./middleware/custom-error";

export function expressServer(): Express {
    const app = express();

    app.use(helmet());
    app.use(cors({
        origin: env.CLIENT_URL ? [env.CLIENT_URL] : true,
        credentials: true,
    }));
    app.use(express.json({ limit: "1mb" }));

    app.get("/health", (_req, res: Response) => {
        res.json({
            success: true,
            message: "Callie backend is healthy",
            environment: env.NODE_ENV,
        });
    });

    app.use("/api/auth", authRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/calls", callRoutes);
    app.use(customError);

    return app;
}

import { createServer } from "node:http";
import { expressServer } from "./app/app";
import { env } from "./app/config/env";
import { pool } from "./db/db-connect";
import { configureSocketServer } from "./app/services/socket.service";

async function startServer() {
    try {
        await pool.query("select 1");

        const app = expressServer();
        const server = createServer(app);
        configureSocketServer(server);

        server.listen(env.PORT, () => {
            console.log(`Callie backend listening on port ${env.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start backend", error);
        process.exit(1);
    }
}

void startServer();

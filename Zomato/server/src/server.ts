import { createServer } from "node:http";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import { createSocketServer } from "./socket/index.js";
import { app } from "./app.js";

const httpServer = createServer(app);
createSocketServer(httpServer);

const startServer = async () => {
  try {
    await prisma.$connect();

    httpServer.listen(env.PORT, () => {
      logger.info(`Server is running on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  logger.warn(`Received ${signal}. Shutting down gracefully.`);

  httpServer.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void startServer();

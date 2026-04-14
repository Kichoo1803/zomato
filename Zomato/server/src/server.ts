import { createServer } from "node:http";
import { env } from "./config/env.js";
import { startCronJobs } from "./jobs/cron.js";
import { prisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import { createSocketServer } from "./socket/index.js";
import { app } from "./app.js";

const httpServer = createServer(app);
createSocketServer(httpServer);

const handleListenError = async (error: NodeJS.ErrnoException) => {
  const message =
    error.code === "EADDRINUSE"
      ? `Port ${env.PORT} is already in use`
      : error.code === "EACCES"
        ? `Port ${env.PORT} requires elevated permissions`
        : "Failed to bind the HTTP server";

  logger.error(message, {
    code: error.code ?? "UNKNOWN",
    error: error.message,
    port: env.PORT,
  });

  await prisma.$disconnect().catch((disconnectError) => {
    logger.error("Failed to disconnect Prisma after startup error", {
      error: disconnectError instanceof Error ? disconnectError.message : "Unknown disconnect error",
    });
  });

  process.exit(1);
};

const startServer = async () => {
  try {
    await prisma.$connect();

    try {
      startCronJobs();
    } catch (error) {
      logger.error("Failed to start cron jobs", {
        error: error instanceof Error ? error.message : "Unknown scheduler error",
      });
    }

    const onListenError = (error: Error) => {
      void handleListenError(error as NodeJS.ErrnoException);
    };

    httpServer.once("error", onListenError);

    httpServer.listen(env.PORT, () => {
      httpServer.off("error", onListenError);
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

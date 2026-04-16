import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

const summarizeDatabaseTarget = (databaseUrl: string) => {
  if (databaseUrl.startsWith("file:")) {
    return {
      provider: "sqlite",
      target: databaseUrl,
    };
  }

  try {
    const url = new URL(databaseUrl);
    return {
      provider: url.protocol.replace(":", ""),
      target: `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`,
    };
  } catch {
    return {
      provider: "unknown",
      target: "Invalid DATABASE_URL",
    };
  }
};

export const prismaConnectionInfo = summarizeDatabaseTarget(env.DATABASE_URL);

const createPrismaClient = () =>
  new PrismaClient({
    log: env.isDevelopment ? ["query", "warn", "error"] : ["warn", "error"],
  });

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

let connectPromise: Promise<void> | null = null;

export const connectPrisma = async ({
  maxAttempts = env.isProduction ? 5 : 3,
  retryDelayMs = 1500,
}: {
  maxAttempts?: number;
  retryDelayMs?: number;
} = {}) => {
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await prisma.$connect();
        logger.info("Prisma connection established", {
          ...prismaConnectionInfo,
          attempt,
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Prisma connection error";
        const shouldRetry = attempt < maxAttempts;

        logger[shouldRetry ? "warn" : "error"]("Prisma connection attempt failed", {
          ...prismaConnectionInfo,
          attempt,
          maxAttempts,
          retryDelayMs,
          error: message,
        });

        if (!shouldRetry) {
          throw error;
        }

        await sleep(retryDelayMs * attempt);
      }
    }
  })().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
};

export const disconnectPrisma = async () => {
  await prisma.$disconnect();
};

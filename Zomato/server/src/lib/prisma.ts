import { env } from "../config/env.js";
import { logger } from "./logger.js";
import { createPrismaClient, type AppPrismaClient } from "./prisma-client.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: AppPrismaClient;
};

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));
const DEFAULT_MONGO_SERVER_SELECTION_TIMEOUT_MS = 5000;
const DEFAULT_MONGO_CONNECT_TIMEOUT_MS = 5000;

const applyMongoConnectionTimeouts = (databaseUrl: string) => {
  if (!databaseUrl.startsWith("mongodb://") && !databaseUrl.startsWith("mongodb+srv://")) {
    return databaseUrl;
  }

  try {
    const url = new URL(databaseUrl);

    if (!url.searchParams.has("serverSelectionTimeoutMS")) {
      url.searchParams.set("serverSelectionTimeoutMS", String(DEFAULT_MONGO_SERVER_SELECTION_TIMEOUT_MS));
    }

    if (!url.searchParams.has("connectTimeoutMS")) {
      url.searchParams.set("connectTimeoutMS", String(DEFAULT_MONGO_CONNECT_TIMEOUT_MS));
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
};

const runtimeDatabaseUrl = applyMongoConnectionTimeouts(env.DATABASE_URL);

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

const getMongoConnectionTimeouts = (databaseUrl: string) => {
  if (!databaseUrl.startsWith("mongodb://") && !databaseUrl.startsWith("mongodb+srv://")) {
    return {};
  }

  try {
    const url = new URL(databaseUrl);
    return {
      serverSelectionTimeoutMs: Number(
        url.searchParams.get("serverSelectionTimeoutMS") ?? DEFAULT_MONGO_SERVER_SELECTION_TIMEOUT_MS,
      ),
      connectTimeoutMs: Number(url.searchParams.get("connectTimeoutMS") ?? DEFAULT_MONGO_CONNECT_TIMEOUT_MS),
    };
  } catch {
    return {};
  }
};

export const prismaConnectionInfo = {
  ...summarizeDatabaseTarget(runtimeDatabaseUrl),
  ...getMongoConnectionTimeouts(runtimeDatabaseUrl),
};

const createPrisma = () =>
  createPrismaClient({
    datasources: {
      db: {
        url: runtimeDatabaseUrl,
      },
    },
    log: env.isDevelopment ? ["query", "warn", "error"] : ["warn", "error"],
  });

export const prisma = globalForPrisma.prisma ?? createPrisma();

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

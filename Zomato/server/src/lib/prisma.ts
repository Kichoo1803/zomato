import { env } from "../config/env.js";
import { logger } from "./logger.js";
import { createPrismaClient, type AppPrismaClient } from "./prisma-client.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: AppPrismaClient;
};

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));
const DEFAULT_MONGO_SERVER_SELECTION_TIMEOUT_MS = 5000;
const DEFAULT_MONGO_CONNECT_TIMEOUT_MS = 5000;
const MONGODB_PROTOCOLS = ["mongodb://", "mongodb+srv://"] as const;

type PrismaConnectionStatus = "idle" | "connecting" | "connected" | "error";

type PrismaConnectionState = {
  status: PrismaConnectionStatus;
  lastCheckedAt: string | null;
  lastConnectedAt: string | null;
  lastErrorAt: string | null;
  errorMessage: string | null;
};

const applyMongoConnectionTimeouts = (databaseUrl: string) => {
  if (!MONGODB_PROTOCOLS.some((protocol) => databaseUrl.startsWith(protocol))) {
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

const redactDatabaseSecrets = (value: string) =>
  value
    .replace(/(mongodb(?:\+srv)?:\/\/)([^@\s]+)@/gi, "$1***@")
    .replace(/([?&](?:password|passwd|pwd)=)([^&\s]+)/gi, "$1***");

const summarizeDatabaseTarget = (databaseUrl: string) => {
  if (databaseUrl.startsWith("file:")) {
    return {
      provider: "sqlite",
      target: redactDatabaseSecrets(databaseUrl),
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

const prismaConnectionState: PrismaConnectionState = {
  status: "idle",
  lastCheckedAt: null,
  lastConnectedAt: null,
  lastErrorAt: null,
  errorMessage: null,
};

const updatePrismaConnectionState = (nextState: Partial<PrismaConnectionState>) => {
  Object.assign(prismaConnectionState, nextState);
};

const sanitizePrismaErrorMessage = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : "Unknown Prisma connection error";
  return redactDatabaseSecrets(rawMessage);
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

const runPrismaHealthCheck = async () => {
  await prisma.$connect();

  if (MONGODB_PROTOCOLS.some((protocol) => runtimeDatabaseUrl.startsWith(protocol))) {
    await prisma.$runCommandRaw({
      ping: 1,
    });
  }
};

export const getPrismaConnectionState = () => ({
  ...prismaConnectionState,
});

export const checkPrismaHealth = async () => {
  const checkedAt = new Date().toISOString();

  try {
    await runPrismaHealthCheck();

    updatePrismaConnectionState({
      status: "connected",
      lastCheckedAt: checkedAt,
      lastConnectedAt: checkedAt,
      errorMessage: null,
    });

    return {
      status: "connected" as const,
      checkedAt,
    };
  } catch (error) {
    const errorMessage = sanitizePrismaErrorMessage(error);

    updatePrismaConnectionState({
      status: "error",
      lastCheckedAt: checkedAt,
      lastErrorAt: checkedAt,
      errorMessage,
    });

    return {
      status: "error" as const,
      checkedAt,
      errorMessage,
    };
  }
};

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
    updatePrismaConnectionState({
      status: "connecting",
      lastCheckedAt: new Date().toISOString(),
      errorMessage: null,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await runPrismaHealthCheck();

        const connectedAt = new Date().toISOString();

        updatePrismaConnectionState({
          status: "connected",
          lastCheckedAt: connectedAt,
          lastConnectedAt: connectedAt,
          errorMessage: null,
        });

        logger.info("Prisma connection established", {
          ...prismaConnectionInfo,
          attempt,
        });
        return;
      } catch (error) {
        const checkedAt = new Date().toISOString();
        const message = sanitizePrismaErrorMessage(error);
        const shouldRetry = attempt < maxAttempts;

        updatePrismaConnectionState({
          status: shouldRetry ? "connecting" : "error",
          lastCheckedAt: checkedAt,
          lastErrorAt: checkedAt,
          errorMessage: message,
        });

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
  updatePrismaConnectionState({
    status: "idle",
  });
};

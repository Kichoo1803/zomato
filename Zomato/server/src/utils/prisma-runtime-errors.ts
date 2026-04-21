import { Prisma } from "@prisma/client";

type PrismaRuntimeErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
};

const getKnownRequestMetaMessage = (error: Prisma.PrismaClientKnownRequestError) => {
  const metaMessage = error.meta?.message;
  return typeof metaMessage === "string" ? metaMessage : "";
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return getKnownRequestMetaMessage(error);
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return error.message;
  }

  return "";
};

const includesAnyFragment = (value: string, fragments: string[]) =>
  fragments.some((fragment) => value.includes(fragment));

const mongoConnectionFragments = [
  "server selection timeout",
  "no available servers",
  "replicasetnoprimary",
  "connection refused",
  "connection reset",
  "database server",
  "i/o error",
  "topology",
];

const mongoReplicaSetFragments = [
  "transactions are not supported by this deployment",
  "requires your mongodb server to be run as a replica set",
  "not running with --replset",
];

export const getPrismaRuntimeErrorResponse = (
  error: unknown,
  {
    isDevelopment,
    fallbackMessage = "A database request failed",
  }: {
    isDevelopment: boolean;
    fallbackMessage?: string;
  },
): PrismaRuntimeErrorResponse | null => {
  const errorMessage = getErrorMessage(error).toLowerCase();

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2010" &&
      includesAnyFragment(errorMessage, mongoConnectionFragments)) ||
    (error instanceof Prisma.PrismaClientUnknownRequestError &&
      includesAnyFragment(errorMessage, mongoConnectionFragments))
  ) {
    return {
      statusCode: 500,
      code: "DATABASE_CONNECTION_FAILED",
      message: isDevelopment
        ? "The server could not connect to MongoDB. Check DATABASE_URL and confirm the configured MongoDB host and port are reachable."
        : fallbackMessage,
      details: isDevelopment ? getErrorMessage(error) : undefined,
    };
  }

  if (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2010" &&
      includesAnyFragment(errorMessage, mongoReplicaSetFragments)) ||
    (error instanceof Prisma.PrismaClientUnknownRequestError &&
      includesAnyFragment(errorMessage, mongoReplicaSetFragments))
  ) {
    return {
      statusCode: 500,
      code: "MONGODB_REPLICA_SET_REQUIRED",
      message: isDevelopment
        ? "MongoDB transactions require a replica set. Start MongoDB as a replica set and use a matching DATABASE_URL."
        : fallbackMessage,
      details: isDevelopment ? getErrorMessage(error) : undefined,
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 500,
      code: "PRISMA_CLIENT_OUT_OF_SYNC",
      message: isDevelopment
        ? "The Prisma client is out of sync with the schema. Run `npm run prisma:generate` and restart the server."
        : fallbackMessage,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code)) {
    return {
      statusCode: 500,
      code: "DATABASE_SCHEMA_NOT_READY",
      message: isDevelopment
        ? "The MongoDB schema or indexes are out of date. Run `npm run prisma:push` and restart the server."
        : fallbackMessage,
      details: isDevelopment ? error.meta : undefined,
    };
  }

  return null;
};

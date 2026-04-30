type PrismaRuntimeErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
};

type PrismaLikeKnownRequestError = Error & {
  code: string;
  meta?: unknown;
};

const isNamedError = (error: unknown, name: string): error is Error =>
  error instanceof Error && error.name === name;

const isPrismaKnownRequestError = (error: unknown): error is PrismaLikeKnownRequestError =>
  isNamedError(error, "PrismaClientKnownRequestError") &&
  typeof (error as { code?: unknown }).code === "string";

const isPrismaInitializationError = (error: unknown): error is Error =>
  isNamedError(error, "PrismaClientInitializationError");

const isPrismaValidationError = (error: unknown): error is Error =>
  isNamedError(error, "PrismaClientValidationError");

const isPrismaUnknownRequestError = (error: unknown): error is Error =>
  isNamedError(error, "PrismaClientUnknownRequestError");

const getKnownRequestMetaMessage = (error: PrismaLikeKnownRequestError) => {
  if (!error.meta || typeof error.meta !== "object") {
    return "";
  }

  const metaMessage = Reflect.get(error.meta, "message");
  return typeof metaMessage === "string" ? metaMessage : "";
};

const getErrorMessage = (error: unknown) => {
  if (isPrismaKnownRequestError(error)) {
    return getKnownRequestMetaMessage(error) || error.message;
  }

  if (
    isPrismaInitializationError(error) ||
    isPrismaValidationError(error) ||
    isPrismaUnknownRequestError(error)
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
    fallbackMessage = "The database could not complete this request right now.",
  }: {
    isDevelopment: boolean;
    fallbackMessage?: string;
  },
): PrismaRuntimeErrorResponse | null => {
  const errorMessage = getErrorMessage(error).toLowerCase();

  if (
    isPrismaInitializationError(error) ||
    (isPrismaKnownRequestError(error) &&
      error.code === "P2010" &&
      includesAnyFragment(errorMessage, mongoConnectionFragments)) ||
    (isPrismaUnknownRequestError(error) &&
      includesAnyFragment(errorMessage, mongoConnectionFragments))
  ) {
    return {
      statusCode: 503,
      code: "DATABASE_CONNECTION_FAILED",
      message: isDevelopment
        ? "The server could not connect to MongoDB. Check DATABASE_URL and confirm the configured MongoDB host and port are reachable."
        : "The API could not reach the database right now. Please try again shortly.",
      details: isDevelopment ? getErrorMessage(error) : undefined,
    };
  }

  if (
    (isPrismaKnownRequestError(error) &&
      error.code === "P2010" &&
      includesAnyFragment(errorMessage, mongoReplicaSetFragments)) ||
    (isPrismaUnknownRequestError(error) &&
      includesAnyFragment(errorMessage, mongoReplicaSetFragments))
  ) {
    return {
      statusCode: 503,
      code: "MONGODB_REPLICA_SET_REQUIRED",
      message: isDevelopment
        ? "MongoDB transactions require a replica set. Start MongoDB as a replica set and use a matching DATABASE_URL."
        : "The database deployment is not ready for transaction-based requests.",
      details: isDevelopment ? getErrorMessage(error) : undefined,
    };
  }

  if (isPrismaValidationError(error)) {
    return {
      statusCode: 500,
      code: "PRISMA_CLIENT_OUT_OF_SYNC",
      message: isDevelopment
        ? "The Prisma client is out of sync with the schema. Run `npm run prisma:generate` and restart the server."
        : "The API database client is temporarily out of sync.",
    };
  }

  if (isPrismaKnownRequestError(error) && ["P2021", "P2022"].includes(error.code)) {
    return {
      statusCode: 503,
      code: "DATABASE_SCHEMA_NOT_READY",
      message: isDevelopment
        ? "The MongoDB schema or indexes are out of date. Run `npm run prisma:push` and restart the server."
        : "The database is not ready to serve this request yet.",
      details: isDevelopment ? error.meta : undefined,
    };
  }

  return null;
};

import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";

type IndexSpec = {
  collection: string;
  name: string;
  key: Prisma.InputJsonObject;
  partialFilterExpression?: Prisma.InputJsonObject;
  unique?: boolean;
  dropNames: string[];
};

const prisma = new PrismaClient();

const managedIndexes: IndexSpec[] = [
  {
    collection: "users",
    name: "users_phone_unique_non_null",
    key: { phone: 1 },
    unique: true,
    partialFilterExpression: {
      phone: { $type: "string" },
    },
    dropNames: ["users_phone_key", "users_phone_unique_non_null"],
  },
  {
    collection: "restaurants",
    name: "restaurants_license_number_unique_non_null",
    key: { license_number: 1 },
    unique: true,
    partialFilterExpression: {
      license_number: { $type: "string" },
    },
    dropNames: [
      "restaurants_license_number_key",
      "restaurants_license_number_unique_non_null",
    ],
  },
  {
    collection: "offers",
    name: "offers_code_unique_non_null",
    key: { code: 1 },
    unique: true,
    partialFilterExpression: {
      code: { $type: "string" },
    },
    dropNames: ["offers_code_key", "offers_code_unique_non_null"],
  },
  {
    collection: "payments",
    name: "payments_transaction_id_unique_non_null",
    key: { transaction_id: 1 },
    unique: true,
    partialFilterExpression: {
      transaction_id: { $type: "string" },
    },
    dropNames: [
      "payments_transaction_id_key",
      "payments_transaction_id_unique_non_null",
    ],
  },
  {
    collection: "reviews",
    name: "reviews_order_id_unique_non_null",
    key: { order_id: 1 },
    unique: true,
    partialFilterExpression: {
      order_id: { $type: "int" },
    },
    dropNames: ["reviews_order_id_key", "reviews_order_id_unique_non_null"],
  },
  {
    collection: "regions",
    name: "regions_manager_user_id_idx",
    key: { manager_user_id: 1 },
    dropNames: ["regions_manager_user_id_key", "regions_manager_user_id_idx"],
  },
];

const isIgnorableDropError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes("index not found") ||
    error.message.includes("ns not found") ||
    error.message.includes("NamespaceNotFound"));

const dropIndexIfExists = async (collection: string, indexName: string) => {
  try {
    await prisma.$runCommandRaw({
      dropIndexes: collection,
      index: indexName,
    });
  } catch (error) {
    if (!isIgnorableDropError(error)) {
      throw error;
    }
  }
};

const ensureIndex = async (spec: IndexSpec) => {
  for (const indexName of spec.dropNames) {
    await dropIndexIfExists(spec.collection, indexName);
  }

  const indexDefinition = {
    name: spec.name,
    key: spec.key,
    unique: spec.unique ?? false,
    ...(spec.partialFilterExpression
      ? {
          partialFilterExpression: spec.partialFilterExpression,
        }
      : {}),
  } as Prisma.InputJsonObject;

  await prisma.$runCommandRaw({
    createIndexes: spec.collection,
    indexes: [
      indexDefinition,
    ] as Prisma.InputJsonArray,
  });
};

const main = async () => {
  for (const spec of managedIndexes) {
    await ensureIndex(spec);
    console.log(`Ensured MongoDB index: ${spec.collection}.${spec.name}`);
  }
};

main()
  .catch((error) => {
    console.error("MongoDB partial index sync failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

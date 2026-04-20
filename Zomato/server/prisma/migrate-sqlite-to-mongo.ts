// @ts-nocheck
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient as LegacySQLiteClient } from "../src/generated/sqlite-legacy-client/index.js";
import { createPrismaClient } from "../src/lib/prisma-client.js";

type RecordShape = Record<string, unknown>;
type LegacyDelegate = {
  findMany: () => Promise<RecordShape[]>;
};
type MongoDelegate = {
  createMany: (args: { data: RecordShape[] }) => Promise<unknown>;
  count: () => Promise<number>;
};

type TransferStep = {
  key: string;
  label: string;
  read: () => Promise<RecordShape[]>;
  write: (records: RecordShape[]) => Promise<void>;
};

const reportsDir = path.resolve("prisma", "reports");
const backupsDir = path.resolve("prisma", "backups");
const idMappings = new Map<string, Map<number, string>>();
const migrationStats: Record<string, { readCount: number; insertedCount: number }> = {};

const ensureDirectories = async () => {
  await Promise.all([
    fs.mkdir(reportsDir, { recursive: true }),
    fs.mkdir(backupsDir, { recursive: true }),
  ]);
};

const createObjectId = () => crypto.randomBytes(12).toString("hex");

const createTimestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const resolveLegacySqlitePath = (sqliteUrl: string) => {
  if (!sqliteUrl.startsWith("file:")) {
    throw new Error(`Unsupported LEGACY_SQLITE_DATABASE_URL: ${sqliteUrl}`);
  }

  return path.resolve("prisma", sqliteUrl.slice("file:".length));
};

const backupLegacySQLite = async (sqliteUrl: string) => {
  const sourcePath = resolveLegacySqlitePath(sqliteUrl);
  const backupPath = path.join(backupsDir, `dev-${createTimestamp()}.db`);

  await fs.copyFile(sourcePath, backupPath);
  return backupPath;
};

const attachMongoIds = (key: string, records: RecordShape[]) => {
  const modelMap = new Map<number, string>();

  for (const record of records) {
    const numericId = typeof record.id === "number" ? record.id : null;
    if (numericId == null) {
      continue;
    }

    const mongoId = createObjectId();
    record.mongoId = mongoId;
    modelMap.set(numericId, mongoId);
  }

  idMappings.set(key, modelMap);
};

const isReplicaSetRequiredError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes("Transactions are not supported by this deployment") ||
    error.message.includes("requires your MongoDB server to be run as a replica set"));

const logReplicaSetGuidance = () => {
  console.error(
    [
      "MongoDB replica set required for Prisma transactions.",
      'Start MongoDB with `mongod --dbpath "<your-db-path>" --replSet rs0 --bind_ip 127.0.0.1`, run `mongosh --eval "rs.initiate()"`, then use `DATABASE_URL=mongodb://127.0.0.1:27017/zomato?replicaSet=rs0`.',
    ].join(" "),
  );
};

const assertRequiredEnv = (name: "DATABASE_URL" | "LEGACY_SQLITE_DATABASE_URL") => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const mongo = createPrismaClient({
  log: ["warn", "error"],
});
const legacy = new LegacySQLiteClient({
  log: ["warn", "error"],
});

const clearMongoDatabase = async () => {
  await mongo.cartItemAddon.deleteMany();
  await mongo.cartItem.deleteMany();
  await mongo.cart.deleteMany();
  await mongo.orderItemAddon.deleteMany();
  await mongo.orderItem.deleteMany();
  await mongo.payment.deleteMany();
  await mongo.savedPaymentMethod.deleteMany();
  await mongo.review.deleteMany();
  await mongo.notification.deleteMany();
  await mongo.reservation.deleteMany();
  await mongo.orderStatusEvent.deleteMany();
  await mongo.deliveryAssignmentOffer.deleteMany();
  await mongo.order.deleteMany();
  await mongo.favoriteRestaurant.deleteMany();
  await mongo.restaurantOffer.deleteMany();
  await mongo.operationsRegionNote.deleteMany();
  await mongo.deliveryDocument.deleteMany();
  await mongo.deliveryPartner.deleteMany();
  await mongo.itemAddon.deleteMany();
  await mongo.comboItem.deleteMany();
  await mongo.combo.deleteMany();
  await mongo.menuItem.deleteMany();
  await mongo.menuCategory.deleteMany();
  await mongo.restaurantHour.deleteMany();
  await mongo.restaurantCuisine.deleteMany();
  await mongo.restaurantCategoryMap.deleteMany();
  await mongo.offer.deleteMany();
  await mongo.cuisine.deleteMany();
  await mongo.restaurantCategory.deleteMany();
  await mongo.restaurant.deleteMany();
  await mongo.address.deleteMany();
  await mongo.refreshToken.deleteMany();
  await mongo.user.deleteMany();
  await mongo.idCounter.deleteMany();
};

const writeMany = async (key: string, records: RecordShape[], delegate: MongoDelegate) => {
  if (!records.length) {
    await mongo.idCounter.deleteMany({
      where: {
        id: key,
      },
    });
    migrationStats[key] = {
      readCount: 0,
      insertedCount: 0,
    };
    return;
  }

  await delegate.createMany({ data: records });

  const insertedCount = await delegate.count();
  if (insertedCount !== records.length) {
    throw new Error(
      `MongoDB insert count check failed for ${key}. Expected ${records.length}, found ${insertedCount}.`,
    );
  }

  migrationStats[key] = {
    readCount: records.length,
    insertedCount,
  };

  const maxId = Math.max(
    ...records.map((record) => {
      const value = record.id;
      return typeof value === "number" ? value : 0;
    }),
  );

  await mongo.idCounter.upsert({
    where: { id: key },
    create: {
      id: key,
      value: maxId,
    },
    update: {
      value: maxId,
    },
  });
};

const createTransferStep = (
  key: string,
  label: string,
  legacyDelegate: LegacyDelegate,
  mongoDelegate: MongoDelegate,
): TransferStep => ({
  key,
  label,
  read: () => legacyDelegate.findMany(),
  write: (records) => writeMany(key, records, mongoDelegate),
});

const transferSteps: TransferStep[] = [
  createTransferStep("User", "users", legacy.user, mongo.user),
  createTransferStep("RefreshToken", "refresh tokens", legacy.refreshToken, mongo.refreshToken),
  createTransferStep("Address", "addresses", legacy.address, mongo.address),
  createTransferStep("RestaurantCategory", "restaurant categories", legacy.restaurantCategory, mongo.restaurantCategory),
  createTransferStep("Cuisine", "cuisines", legacy.cuisine, mongo.cuisine),
  createTransferStep("Offer", "offers", legacy.offer, mongo.offer),
  createTransferStep("Restaurant", "restaurants", legacy.restaurant, mongo.restaurant),
  createTransferStep(
    "OperationsRegionNote",
    "operations region notes",
    legacy.operationsRegionNote,
    mongo.operationsRegionNote,
  ),
  createTransferStep(
    "RestaurantCategoryMap",
    "restaurant category links",
    legacy.restaurantCategoryMap,
    mongo.restaurantCategoryMap,
  ),
  createTransferStep("RestaurantCuisine", "restaurant cuisine links", legacy.restaurantCuisine, mongo.restaurantCuisine),
  createTransferStep("RestaurantHour", "restaurant hours", legacy.restaurantHour, mongo.restaurantHour),
  createTransferStep("MenuCategory", "menu categories", legacy.menuCategory, mongo.menuCategory),
  createTransferStep("MenuItem", "menu items", legacy.menuItem, mongo.menuItem),
  createTransferStep("Combo", "combos", legacy.combo, mongo.combo),
  createTransferStep("ComboItem", "combo items", legacy.comboItem, mongo.comboItem),
  createTransferStep("ItemAddon", "item addons", legacy.itemAddon, mongo.itemAddon),
  createTransferStep("RestaurantOffer", "restaurant offer links", legacy.restaurantOffer, mongo.restaurantOffer),
  createTransferStep(
    "SavedPaymentMethod",
    "saved payment methods",
    legacy.savedPaymentMethod,
    mongo.savedPaymentMethod,
  ),
  createTransferStep("DeliveryPartner", "delivery partners", legacy.deliveryPartner, mongo.deliveryPartner),
  createTransferStep("DeliveryDocument", "delivery documents", legacy.deliveryDocument, mongo.deliveryDocument),
  createTransferStep("FavoriteRestaurant", "favorites", legacy.favoriteRestaurant, mongo.favoriteRestaurant),
  createTransferStep("Reservation", "reservations", legacy.reservation, mongo.reservation),
  createTransferStep("Cart", "carts", legacy.cart, mongo.cart),
  createTransferStep("CartItem", "cart items", legacy.cartItem, mongo.cartItem),
  createTransferStep("CartItemAddon", "cart item addons", legacy.cartItemAddon, mongo.cartItemAddon),
  createTransferStep("Order", "orders", legacy.order, mongo.order),
  createTransferStep("OrderItem", "order items", legacy.orderItem, mongo.orderItem),
  createTransferStep("OrderItemAddon", "order item addons", legacy.orderItemAddon, mongo.orderItemAddon),
  createTransferStep("Payment", "payments", legacy.payment, mongo.payment),
  createTransferStep("OrderStatusEvent", "order status events", legacy.orderStatusEvent, mongo.orderStatusEvent),
  createTransferStep(
    "DeliveryAssignmentOffer",
    "delivery assignment offers",
    legacy.deliveryAssignmentOffer,
    mongo.deliveryAssignmentOffer,
  ),
  createTransferStep("Review", "reviews", legacy.review, mongo.review),
  createTransferStep("Notification", "notifications", legacy.notification, mongo.notification),
];

const main = async () => {
  assertRequiredEnv("DATABASE_URL");
  const sqliteUrl = assertRequiredEnv("LEGACY_SQLITE_DATABASE_URL");
  await ensureDirectories();

  const backupPath = await backupLegacySQLite(sqliteUrl);
  console.log(`SQLite backup created at ${backupPath}`);

  console.log("Clearing MongoDB collections...");
  await clearMongoDatabase();

  for (const step of transferSteps) {
    const records = await step.read();
    attachMongoIds(step.key, records);
    console.log(`Migrating ${step.label}: ${records.length}`);
    await step.write(records);
  }

  const mappingReport = Object.fromEntries(
    [...idMappings.entries()].map(([model, mappings]) => [
      model,
      Object.fromEntries([...mappings.entries()].map(([legacyId, mongoId]) => [String(legacyId), mongoId])),
    ]),
  );
  const reportPath = path.join(reportsDir, "sqlite-to-mongo-id-map.json");
  await fs.writeFile(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sqliteDatabase: sqliteUrl,
    mongoDatabase: process.env.DATABASE_URL,
    sqliteBackupPath: backupPath,
    migrationStats,
    mappings: mappingReport,
  }, null, 2)}\n`, "utf8");
  console.log(`ID mapping report written to ${reportPath}`);

  console.log("SQLite to MongoDB migration completed successfully.");
};

main()
  .catch((error) => {
    if (isReplicaSetRequiredError(error)) {
      logReplicaSetGuidance();
    }

    console.error("SQLite to MongoDB migration failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([legacy.$disconnect(), mongo.$disconnect()]);
  });

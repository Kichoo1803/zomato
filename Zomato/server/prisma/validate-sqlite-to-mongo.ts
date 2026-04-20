// @ts-nocheck
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient as LegacySQLiteClient } from "../src/generated/sqlite-legacy-client/index.js";
import { createPrismaClient } from "../src/lib/prisma-client.js";

const legacy = new LegacySQLiteClient({
  log: ["warn", "error"],
});

const mongo = createPrismaClient({
  log: ["warn", "error"],
});

const reportsDir = path.resolve("prisma", "reports");

const ensureReportsDir = async () => {
  await fs.mkdir(reportsDir, { recursive: true });
};

const collectCounts = async (client) => ({
  users: await client.user.count(),
  refreshTokens: await client.refreshToken.count(),
  addresses: await client.address.count(),
  restaurants: await client.restaurant.count(),
  restaurantCategories: await client.restaurantCategory.count(),
  restaurantCategoryLinks: await client.restaurantCategoryMap.count(),
  cuisines: await client.cuisine.count(),
  restaurantCuisineLinks: await client.restaurantCuisine.count(),
  restaurantHours: await client.restaurantHour.count(),
  menuCategories: await client.menuCategory.count(),
  menuItems: await client.menuItem.count(),
  combos: await client.combo.count(),
  comboItems: await client.comboItem.count(),
  itemAddons: await client.itemAddon.count(),
  offers: await client.offer.count(),
  restaurantOffers: await client.restaurantOffer.count(),
  carts: await client.cart.count(),
  cartItems: await client.cartItem.count(),
  cartItemAddons: await client.cartItemAddon.count(),
  orders: await client.order.count(),
  orderStatusEvents: await client.orderStatusEvent.count(),
  orderItems: await client.orderItem.count(),
  orderItemAddons: await client.orderItemAddon.count(),
  payments: await client.payment.count(),
  savedPaymentMethods: await client.savedPaymentMethod.count(),
  deliveryPartners: await client.deliveryPartner.count(),
  deliveryAssignmentOffers: await client.deliveryAssignmentOffer.count(),
  deliveryDocuments: await client.deliveryDocument.count(),
  reviews: await client.review.count(),
  favoriteRestaurants: await client.favoriteRestaurant.count(),
  notifications: await client.notification.count(),
  operationsRegionNotes: await client.operationsRegionNote.count(),
  reservations: await client.reservation.count(),
});

const collectMongoOrphans = async () => {
  const [
    userIds,
    restaurantIds,
    addressIds,
    offerIds,
    menuCategoryIds,
    menuItemIds,
    comboIds,
    cartIds,
    cartItemIds,
    orderIds,
    orderItemIds,
    deliveryPartnerIds,
    categoryIds,
    cuisineIds,
    addonIds,
  ] = await Promise.all([
    mongo.user.findMany({ select: { id: true } }),
    mongo.restaurant.findMany({ select: { id: true } }),
    mongo.address.findMany({ select: { id: true } }),
    mongo.offer.findMany({ select: { id: true } }),
    mongo.menuCategory.findMany({ select: { id: true } }),
    mongo.menuItem.findMany({ select: { id: true } }),
    mongo.combo.findMany({ select: { id: true } }),
    mongo.cart.findMany({ select: { id: true } }),
    mongo.cartItem.findMany({ select: { id: true } }),
    mongo.order.findMany({ select: { id: true } }),
    mongo.orderItem.findMany({ select: { id: true } }),
    mongo.deliveryPartner.findMany({ select: { id: true } }),
    mongo.restaurantCategory.findMany({ select: { id: true } }),
    mongo.cuisine.findMany({ select: { id: true } }),
    mongo.itemAddon.findMany({ select: { id: true } }),
  ]);

  const ids = {
    users: new Set(userIds.map((record) => record.id)),
    restaurants: new Set(restaurantIds.map((record) => record.id)),
    addresses: new Set(addressIds.map((record) => record.id)),
    offers: new Set(offerIds.map((record) => record.id)),
    menuCategories: new Set(menuCategoryIds.map((record) => record.id)),
    menuItems: new Set(menuItemIds.map((record) => record.id)),
    combos: new Set(comboIds.map((record) => record.id)),
    carts: new Set(cartIds.map((record) => record.id)),
    cartItems: new Set(cartItemIds.map((record) => record.id)),
    orders: new Set(orderIds.map((record) => record.id)),
    orderItems: new Set(orderItemIds.map((record) => record.id)),
    deliveryPartners: new Set(deliveryPartnerIds.map((record) => record.id)),
    categories: new Set(categoryIds.map((record) => record.id)),
    cuisines: new Set(cuisineIds.map((record) => record.id)),
    addons: new Set(addonIds.map((record) => record.id)),
  };

  const countMissing = (rows, field, validIds, { optional = false } = {}) =>
    rows.filter((row) => {
      const value = row[field];
      if (value == null) {
        return optional ? false : true;
      }

      return !validIds.has(value);
    }).length;

  const [
    refreshTokens,
    addresses,
    restaurants,
    restaurantCategoryLinks,
    restaurantCuisineLinks,
    restaurantHours,
    menuCategories,
    menuItems,
    combos,
    comboItems,
    itemAddons,
    restaurantOffers,
    carts,
    cartItems,
    cartItemAddons,
    orders,
    orderStatusEvents,
    orderItems,
    orderItemAddons,
    payments,
    savedPaymentMethods,
    deliveryPartners,
    deliveryOffers,
    deliveryDocuments,
    reviews,
    favorites,
    notifications,
    regionNotes,
    reservations,
  ] = await Promise.all([
    mongo.refreshToken.findMany({ select: { userId: true } }),
    mongo.address.findMany({ select: { userId: true } }),
    mongo.restaurant.findMany({ select: { ownerId: true } }),
    mongo.restaurantCategoryMap.findMany({ select: { restaurantId: true, categoryId: true } }),
    mongo.restaurantCuisine.findMany({ select: { restaurantId: true, cuisineId: true } }),
    mongo.restaurantHour.findMany({ select: { restaurantId: true } }),
    mongo.menuCategory.findMany({ select: { restaurantId: true } }),
    mongo.menuItem.findMany({ select: { restaurantId: true, categoryId: true } }),
    mongo.combo.findMany({ select: { restaurantId: true } }),
    mongo.comboItem.findMany({ select: { comboId: true, menuItemId: true } }),
    mongo.itemAddon.findMany({ select: { restaurantId: true, menuItemId: true, comboId: true } }),
    mongo.restaurantOffer.findMany({ select: { restaurantId: true, offerId: true } }),
    mongo.cart.findMany({ select: { userId: true, restaurantId: true, offerId: true } }),
    mongo.cartItem.findMany({ select: { cartId: true, menuItemId: true, comboId: true } }),
    mongo.cartItemAddon.findMany({ select: { cartItemId: true, addonId: true } }),
    mongo.order.findMany({
      select: {
        userId: true,
        restaurantId: true,
        addressId: true,
        deliveryPartnerId: true,
        offerId: true,
      },
    }),
    mongo.orderStatusEvent.findMany({ select: { orderId: true, actorId: true } }),
    mongo.orderItem.findMany({ select: { orderId: true, menuItemId: true, comboId: true } }),
    mongo.orderItemAddon.findMany({ select: { orderItemId: true } }),
    mongo.payment.findMany({ select: { orderId: true } }),
    mongo.savedPaymentMethod.findMany({ select: { userId: true } }),
    mongo.deliveryPartner.findMany({ select: { userId: true } }),
    mongo.deliveryAssignmentOffer.findMany({ select: { orderId: true, deliveryPartnerId: true } }),
    mongo.deliveryDocument.findMany({ select: { deliveryPartnerId: true } }),
    mongo.review.findMany({ select: { userId: true, restaurantId: true, orderId: true } }),
    mongo.favoriteRestaurant.findMany({ select: { userId: true, restaurantId: true } }),
    mongo.notification.findMany({ select: { userId: true } }),
    mongo.operationsRegionNote.findMany({ select: { updatedById: true } }),
    mongo.reservation.findMany({ select: { userId: true, restaurantId: true } }),
  ]);

  return {
    refreshTokensWithoutUser: countMissing(refreshTokens, "userId", ids.users),
    addressesWithoutUser: countMissing(addresses, "userId", ids.users),
    restaurantsWithoutOwner: countMissing(restaurants, "ownerId", ids.users),
    restaurantCategoryLinksWithoutRestaurant: countMissing(
      restaurantCategoryLinks,
      "restaurantId",
      ids.restaurants,
    ),
    restaurantCategoryLinksWithoutCategory: countMissing(
      restaurantCategoryLinks,
      "categoryId",
      ids.categories,
    ),
    restaurantCuisineLinksWithoutRestaurant: countMissing(
      restaurantCuisineLinks,
      "restaurantId",
      ids.restaurants,
    ),
    restaurantCuisineLinksWithoutCuisine: countMissing(restaurantCuisineLinks, "cuisineId", ids.cuisines),
    restaurantHoursWithoutRestaurant: countMissing(restaurantHours, "restaurantId", ids.restaurants),
    menuCategoriesWithoutRestaurant: countMissing(menuCategories, "restaurantId", ids.restaurants),
    menuItemsWithoutRestaurant: countMissing(menuItems, "restaurantId", ids.restaurants),
    menuItemsWithoutCategory: countMissing(menuItems, "categoryId", ids.menuCategories),
    combosWithoutRestaurant: countMissing(combos, "restaurantId", ids.restaurants),
    comboItemsWithoutCombo: countMissing(comboItems, "comboId", ids.combos),
    comboItemsWithoutMenuItem: countMissing(comboItems, "menuItemId", ids.menuItems),
    itemAddonsWithoutRestaurant: countMissing(itemAddons, "restaurantId", ids.restaurants),
    itemAddonsWithoutMenuItem: countMissing(itemAddons, "menuItemId", ids.menuItems, { optional: true }),
    itemAddonsWithoutCombo: countMissing(itemAddons, "comboId", ids.combos, { optional: true }),
    restaurantOffersWithoutRestaurant: countMissing(restaurantOffers, "restaurantId", ids.restaurants),
    restaurantOffersWithoutOffer: countMissing(restaurantOffers, "offerId", ids.offers),
    cartsWithoutUser: countMissing(carts, "userId", ids.users),
    cartsWithoutRestaurant: countMissing(carts, "restaurantId", ids.restaurants),
    cartsWithoutOffer: countMissing(carts, "offerId", ids.offers, { optional: true }),
    cartItemsWithoutCart: countMissing(cartItems, "cartId", ids.carts),
    cartItemsWithoutMenuItem: countMissing(cartItems, "menuItemId", ids.menuItems, { optional: true }),
    cartItemsWithoutCombo: countMissing(cartItems, "comboId", ids.combos, { optional: true }),
    cartItemAddonsWithoutCartItem: countMissing(cartItemAddons, "cartItemId", ids.cartItems),
    cartItemAddonsWithoutAddon: countMissing(cartItemAddons, "addonId", ids.addons),
    ordersWithoutUser: countMissing(orders, "userId", ids.users),
    ordersWithoutRestaurant: countMissing(orders, "restaurantId", ids.restaurants),
    ordersWithoutAddress: countMissing(orders, "addressId", ids.addresses),
    ordersWithoutDeliveryPartner: countMissing(orders, "deliveryPartnerId", ids.deliveryPartners, {
      optional: true,
    }),
    ordersWithoutOffer: countMissing(orders, "offerId", ids.offers, { optional: true }),
    orderStatusEventsWithoutOrder: countMissing(orderStatusEvents, "orderId", ids.orders),
    orderStatusEventsWithoutActor: countMissing(orderStatusEvents, "actorId", ids.users, { optional: true }),
    orderItemsWithoutOrder: countMissing(orderItems, "orderId", ids.orders),
    orderItemsWithoutMenuItem: countMissing(orderItems, "menuItemId", ids.menuItems, { optional: true }),
    orderItemsWithoutCombo: countMissing(orderItems, "comboId", ids.combos, { optional: true }),
    orderItemAddonsWithoutOrderItem: countMissing(orderItemAddons, "orderItemId", ids.orderItems),
    paymentsWithoutOrder: countMissing(payments, "orderId", ids.orders),
    savedPaymentMethodsWithoutUser: countMissing(savedPaymentMethods, "userId", ids.users),
    deliveryPartnersWithoutUser: countMissing(deliveryPartners, "userId", ids.users),
    deliveryOffersWithoutOrder: countMissing(deliveryOffers, "orderId", ids.orders),
    deliveryOffersWithoutDeliveryPartner: countMissing(
      deliveryOffers,
      "deliveryPartnerId",
      ids.deliveryPartners,
    ),
    deliveryDocumentsWithoutDeliveryPartner: countMissing(
      deliveryDocuments,
      "deliveryPartnerId",
      ids.deliveryPartners,
    ),
    reviewsWithoutUser: countMissing(reviews, "userId", ids.users),
    reviewsWithoutRestaurant: countMissing(reviews, "restaurantId", ids.restaurants),
    reviewsWithoutOrder: countMissing(reviews, "orderId", ids.orders, { optional: true }),
    favoritesWithoutUser: countMissing(favorites, "userId", ids.users),
    favoritesWithoutRestaurant: countMissing(favorites, "restaurantId", ids.restaurants),
    notificationsWithoutUser: countMissing(notifications, "userId", ids.users),
    regionNotesWithoutAuthor: countMissing(regionNotes, "updatedById", ids.users, { optional: true }),
    reservationsWithoutUser: countMissing(reservations, "userId", ids.users),
    reservationsWithoutRestaurant: countMissing(reservations, "restaurantId", ids.restaurants),
  };
};

const compareUserAuthData = async () => {
  const [legacyUsers, mongoUsers] = await Promise.all([
    legacy.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        passwordHash: true,
        role: true,
      },
      orderBy: { id: "asc" },
    }),
    mongo.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        passwordHash: true,
        role: true,
        mongoId: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const mongoById = new Map(mongoUsers.map((user) => [user.id, user]));
  const mismatches = [];

  for (const legacyUser of legacyUsers) {
    const migratedUser = mongoById.get(legacyUser.id);

    if (!migratedUser) {
      mismatches.push({ id: legacyUser.id, reason: "missing_in_mongo" });
      continue;
    }

    if (
      migratedUser.email !== legacyUser.email ||
      migratedUser.phone !== legacyUser.phone ||
      migratedUser.passwordHash !== legacyUser.passwordHash ||
      migratedUser.role !== legacyUser.role
    ) {
      mismatches.push({
        id: legacyUser.id,
        reason: "auth_fields_mismatch",
        legacy: legacyUser,
        mongo: migratedUser,
      });
    }
  }

  return {
    totalLegacyUsers: legacyUsers.length,
    totalMongoUsers: mongoUsers.length,
    mismatches,
    sampleMappings: mongoUsers.slice(0, 5).map((user) => ({
      id: user.id,
      email: user.email,
      mongoId: user.mongoId,
    })),
  };
};

const main = async () => {
  await ensureReportsDir();

  const [sqliteCounts, mongoCounts, mongoOrphans, authCheck] = await Promise.all([
    collectCounts(legacy),
    collectCounts(mongo),
    collectMongoOrphans(),
    compareUserAuthData(),
  ]);

  const countDiffs = Object.fromEntries(
    Object.keys(sqliteCounts).map((key) => [
      key,
      {
        sqlite: sqliteCounts[key],
        mongo: mongoCounts[key],
        matches: sqliteCounts[key] === mongoCounts[key],
      },
    ]),
  );

  const failedCountKeys = Object.entries(countDiffs)
    .filter(([, value]) => !value.matches)
    .map(([key]) => key);
  const failedOrphanChecks = Object.entries(mongoOrphans)
    .filter(([, value]) => value > 0)
    .map(([key]) => key);

  const report = {
    generatedAt: new Date().toISOString(),
    sqliteDatabase: process.env.LEGACY_SQLITE_DATABASE_URL ?? "file:./dev.db",
    mongoDatabase: process.env.DATABASE_URL ?? "mongodb://127.0.0.1:27017/zomato",
    counts: countDiffs,
    failedCountKeys,
    mongoOrphanChecks: mongoOrphans,
    failedOrphanChecks,
    authCheck,
    success:
      failedCountKeys.length === 0 &&
      failedOrphanChecks.length === 0 &&
      authCheck.mismatches.length === 0,
  };

  const reportPath = path.join(reportsDir, "sqlite-to-mongo-validation.json");
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Validation report written to ${reportPath}`);
  console.log(JSON.stringify({ success: report.success, failedCountKeys, failedOrphanChecks }, null, 2));

  if (!report.success) {
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error("SQLite to MongoDB validation failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([legacy.$disconnect(), mongo.$disconnect()]);
  });

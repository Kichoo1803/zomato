// @ts-nocheck
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient as LegacySQLiteClient } from "../src/generated/sqlite-legacy-client/index.js";

const legacy = new LegacySQLiteClient({
  log: ["warn", "error"],
});

const reportsDir = path.resolve("prisma", "reports");

const ensureReportsDir = async () => {
  await fs.mkdir(reportsDir, { recursive: true });
};

const collectCounts = async () => ({
  users: await legacy.user.count(),
  refreshTokens: await legacy.refreshToken.count(),
  addresses: await legacy.address.count(),
  restaurants: await legacy.restaurant.count(),
  restaurantCategories: await legacy.restaurantCategory.count(),
  restaurantCategoryLinks: await legacy.restaurantCategoryMap.count(),
  cuisines: await legacy.cuisine.count(),
  restaurantCuisineLinks: await legacy.restaurantCuisine.count(),
  restaurantHours: await legacy.restaurantHour.count(),
  menuCategories: await legacy.menuCategory.count(),
  menuItems: await legacy.menuItem.count(),
  combos: await legacy.combo.count(),
  comboItems: await legacy.comboItem.count(),
  itemAddons: await legacy.itemAddon.count(),
  offers: await legacy.offer.count(),
  restaurantOffers: await legacy.restaurantOffer.count(),
  carts: await legacy.cart.count(),
  cartItems: await legacy.cartItem.count(),
  cartItemAddons: await legacy.cartItemAddon.count(),
  orders: await legacy.order.count(),
  orderStatusEvents: await legacy.orderStatusEvent.count(),
  orderItems: await legacy.orderItem.count(),
  orderItemAddons: await legacy.orderItemAddon.count(),
  payments: await legacy.payment.count(),
  savedPaymentMethods: await legacy.savedPaymentMethod.count(),
  deliveryPartners: await legacy.deliveryPartner.count(),
  deliveryAssignmentOffers: await legacy.deliveryAssignmentOffer.count(),
  deliveryDocuments: await legacy.deliveryDocument.count(),
  reviews: await legacy.review.count(),
  favoriteRestaurants: await legacy.favoriteRestaurant.count(),
  notifications: await legacy.notification.count(),
  operationsRegionNotes: await legacy.operationsRegionNote.count(),
  reservations: await legacy.reservation.count(),
});

const countOrphans = async () => {
  const [
    users,
    restaurants,
    addresses,
    offers,
    menuCategories,
    menuItems,
    combos,
    carts,
    cartItems,
    orders,
    orderItems,
    deliveryPartners,
    deliveryOffers,
    restaurantCategories,
    cuisines,
    addons,
  ] = await Promise.all([
    legacy.user.findMany({ select: { id: true } }),
    legacy.restaurant.findMany({ select: { id: true } }),
    legacy.address.findMany({ select: { id: true } }),
    legacy.offer.findMany({ select: { id: true } }),
    legacy.menuCategory.findMany({ select: { id: true } }),
    legacy.menuItem.findMany({ select: { id: true } }),
    legacy.combo.findMany({ select: { id: true } }),
    legacy.cart.findMany({ select: { id: true } }),
    legacy.cartItem.findMany({ select: { id: true } }),
    legacy.order.findMany({ select: { id: true } }),
    legacy.orderItem.findMany({ select: { id: true } }),
    legacy.deliveryPartner.findMany({ select: { id: true } }),
    legacy.deliveryAssignmentOffer.findMany({ select: { id: true } }),
    legacy.restaurantCategory.findMany({ select: { id: true } }),
    legacy.cuisine.findMany({ select: { id: true } }),
    legacy.itemAddon.findMany({ select: { id: true } }),
  ]);

  const userIds = new Set(users.map((record) => record.id));
  const restaurantIds = new Set(restaurants.map((record) => record.id));
  const addressIds = new Set(addresses.map((record) => record.id));
  const offerIds = new Set(offers.map((record) => record.id));
  const menuCategoryIds = new Set(menuCategories.map((record) => record.id));
  const menuItemIds = new Set(menuItems.map((record) => record.id));
  const comboIds = new Set(combos.map((record) => record.id));
  const cartIds = new Set(carts.map((record) => record.id));
  const cartItemIds = new Set(cartItems.map((record) => record.id));
  const orderIds = new Set(orders.map((record) => record.id));
  const orderItemIds = new Set(orderItems.map((record) => record.id));
  const deliveryPartnerIds = new Set(deliveryPartners.map((record) => record.id));
  const restaurantCategoryIds = new Set(restaurantCategories.map((record) => record.id));
  const cuisineIds = new Set(cuisines.map((record) => record.id));
  const addonIds = new Set(addons.map((record) => record.id));

  const [
    refreshTokens,
    addressRows,
    restaurantRows,
    restaurantCategoryRows,
    restaurantCuisineRows,
    restaurantHourRows,
    menuCategoryRows,
    menuItemRows,
    comboRows,
    comboItemRows,
    itemAddonRows,
    restaurantOfferRows,
    cartRows,
    cartItemRows,
    cartItemAddonRows,
    orderRows,
    orderStatusRows,
    orderItemRows,
    orderItemAddonRows,
    paymentRows,
    savedPaymentRows,
    deliveryPartnerRows,
    deliveryOfferRows,
    deliveryDocumentRows,
    reviewRows,
    favoriteRows,
    notificationRows,
    regionNoteRows,
    reservationRows,
  ] = await Promise.all([
    legacy.refreshToken.findMany({ select: { userId: true } }),
    legacy.address.findMany({ select: { userId: true } }),
    legacy.restaurant.findMany({ select: { ownerId: true } }),
    legacy.restaurantCategoryMap.findMany({ select: { restaurantId: true, categoryId: true } }),
    legacy.restaurantCuisine.findMany({ select: { restaurantId: true, cuisineId: true } }),
    legacy.restaurantHour.findMany({ select: { restaurantId: true } }),
    legacy.menuCategory.findMany({ select: { restaurantId: true } }),
    legacy.menuItem.findMany({ select: { restaurantId: true, categoryId: true } }),
    legacy.combo.findMany({ select: { restaurantId: true } }),
    legacy.comboItem.findMany({ select: { comboId: true, menuItemId: true } }),
    legacy.itemAddon.findMany({ select: { restaurantId: true, menuItemId: true, comboId: true } }),
    legacy.restaurantOffer.findMany({ select: { restaurantId: true, offerId: true } }),
    legacy.cart.findMany({ select: { userId: true, restaurantId: true, offerId: true } }),
    legacy.cartItem.findMany({ select: { cartId: true, menuItemId: true, comboId: true } }),
    legacy.cartItemAddon.findMany({ select: { cartItemId: true, addonId: true } }),
    legacy.order.findMany({
      select: {
        userId: true,
        restaurantId: true,
        addressId: true,
        deliveryPartnerId: true,
        offerId: true,
      },
    }),
    legacy.orderStatusEvent.findMany({ select: { orderId: true, actorId: true } }),
    legacy.orderItem.findMany({ select: { orderId: true, menuItemId: true, comboId: true } }),
    legacy.orderItemAddon.findMany({ select: { orderItemId: true } }),
    legacy.payment.findMany({ select: { orderId: true } }),
    legacy.savedPaymentMethod.findMany({ select: { userId: true } }),
    legacy.deliveryPartner.findMany({ select: { userId: true } }),
    legacy.deliveryAssignmentOffer.findMany({ select: { orderId: true, deliveryPartnerId: true } }),
    legacy.deliveryDocument.findMany({ select: { deliveryPartnerId: true } }),
    legacy.review.findMany({ select: { userId: true, restaurantId: true, orderId: true } }),
    legacy.favoriteRestaurant.findMany({ select: { userId: true, restaurantId: true } }),
    legacy.notification.findMany({ select: { userId: true } }),
    legacy.operationsRegionNote.findMany({ select: { updatedById: true } }),
    legacy.reservation.findMany({ select: { userId: true, restaurantId: true } }),
  ]);

  const countMissing = (rows, field, validIds, { optional = false } = {}) =>
    rows.filter((row) => {
      const value = row[field];
      if (value == null) {
        return optional ? false : true;
      }

      return !validIds.has(value);
    }).length;

  return {
    refreshTokensWithoutUser: countMissing(refreshTokens, "userId", userIds),
    addressesWithoutUser: countMissing(addressRows, "userId", userIds),
    restaurantsWithoutOwner: countMissing(restaurantRows, "ownerId", userIds),
    restaurantCategoryLinksWithoutRestaurant: countMissing(
      restaurantCategoryRows,
      "restaurantId",
      restaurantIds,
    ),
    restaurantCategoryLinksWithoutCategory: countMissing(
      restaurantCategoryRows,
      "categoryId",
      restaurantCategoryIds,
    ),
    restaurantCuisineLinksWithoutRestaurant: countMissing(
      restaurantCuisineRows,
      "restaurantId",
      restaurantIds,
    ),
    restaurantCuisineLinksWithoutCuisine: countMissing(restaurantCuisineRows, "cuisineId", cuisineIds),
    restaurantHoursWithoutRestaurant: countMissing(restaurantHourRows, "restaurantId", restaurantIds),
    menuCategoriesWithoutRestaurant: countMissing(menuCategoryRows, "restaurantId", restaurantIds),
    menuItemsWithoutRestaurant: countMissing(menuItemRows, "restaurantId", restaurantIds),
    menuItemsWithoutCategory: countMissing(menuItemRows, "categoryId", menuCategoryIds),
    combosWithoutRestaurant: countMissing(comboRows, "restaurantId", restaurantIds),
    comboItemsWithoutCombo: countMissing(comboItemRows, "comboId", comboIds),
    comboItemsWithoutMenuItem: countMissing(comboItemRows, "menuItemId", menuItemIds),
    itemAddonsWithoutRestaurant: countMissing(itemAddonRows, "restaurantId", restaurantIds),
    itemAddonsWithoutMenuItem: countMissing(itemAddonRows, "menuItemId", menuItemIds, { optional: true }),
    itemAddonsWithoutCombo: countMissing(itemAddonRows, "comboId", comboIds, { optional: true }),
    restaurantOffersWithoutRestaurant: countMissing(restaurantOfferRows, "restaurantId", restaurantIds),
    restaurantOffersWithoutOffer: countMissing(restaurantOfferRows, "offerId", offerIds),
    cartsWithoutUser: countMissing(cartRows, "userId", userIds),
    cartsWithoutRestaurant: countMissing(cartRows, "restaurantId", restaurantIds),
    cartsWithoutOffer: countMissing(cartRows, "offerId", offerIds, { optional: true }),
    cartItemsWithoutCart: countMissing(cartItemRows, "cartId", cartIds),
    cartItemsWithoutMenuItem: countMissing(cartItemRows, "menuItemId", menuItemIds, { optional: true }),
    cartItemsWithoutCombo: countMissing(cartItemRows, "comboId", comboIds, { optional: true }),
    cartItemAddonsWithoutCartItem: countMissing(cartItemAddonRows, "cartItemId", cartItemIds),
    cartItemAddonsWithoutAddon: countMissing(cartItemAddonRows, "addonId", addonIds),
    ordersWithoutUser: countMissing(orderRows, "userId", userIds),
    ordersWithoutRestaurant: countMissing(orderRows, "restaurantId", restaurantIds),
    ordersWithoutAddress: countMissing(orderRows, "addressId", addressIds),
    ordersWithoutDeliveryPartner: countMissing(orderRows, "deliveryPartnerId", deliveryPartnerIds, {
      optional: true,
    }),
    ordersWithoutOffer: countMissing(orderRows, "offerId", offerIds, { optional: true }),
    orderStatusEventsWithoutOrder: countMissing(orderStatusRows, "orderId", orderIds),
    orderStatusEventsWithoutActor: countMissing(orderStatusRows, "actorId", userIds, { optional: true }),
    orderItemsWithoutOrder: countMissing(orderItemRows, "orderId", orderIds),
    orderItemsWithoutMenuItem: countMissing(orderItemRows, "menuItemId", menuItemIds, { optional: true }),
    orderItemsWithoutCombo: countMissing(orderItemRows, "comboId", comboIds, { optional: true }),
    orderItemAddonsWithoutOrderItem: countMissing(orderItemAddonRows, "orderItemId", orderItemIds),
    paymentsWithoutOrder: countMissing(paymentRows, "orderId", orderIds),
    savedPaymentMethodsWithoutUser: countMissing(savedPaymentRows, "userId", userIds),
    deliveryPartnersWithoutUser: countMissing(deliveryPartnerRows, "userId", userIds),
    deliveryOffersWithoutOrder: countMissing(deliveryOfferRows, "orderId", orderIds),
    deliveryOffersWithoutDeliveryPartner: countMissing(
      deliveryOfferRows,
      "deliveryPartnerId",
      deliveryPartnerIds,
    ),
    deliveryDocumentsWithoutDeliveryPartner: countMissing(
      deliveryDocumentRows,
      "deliveryPartnerId",
      deliveryPartnerIds,
    ),
    reviewsWithoutUser: countMissing(reviewRows, "userId", userIds),
    reviewsWithoutRestaurant: countMissing(reviewRows, "restaurantId", restaurantIds),
    reviewsWithoutOrder: countMissing(reviewRows, "orderId", orderIds, { optional: true }),
    favoritesWithoutUser: countMissing(favoriteRows, "userId", userIds),
    favoritesWithoutRestaurant: countMissing(favoriteRows, "restaurantId", restaurantIds),
    notificationsWithoutUser: countMissing(notificationRows, "userId", userIds),
    regionNotesWithoutAuthor: countMissing(regionNoteRows, "updatedById", userIds, { optional: true }),
    reservationsWithoutUser: countMissing(reservationRows, "userId", userIds),
    reservationsWithoutRestaurant: countMissing(reservationRows, "restaurantId", restaurantIds),
  };
};

const collectSamples = async () => ({
  users: await legacy.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      membershipTier: true,
      membershipStatus: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
    take: 5,
  }),
  restaurants: await legacy.restaurant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      city: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { id: "asc" },
    take: 5,
  }),
  orders: await legacy.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      restaurantId: true,
      deliveryPartnerId: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      orderedAt: true,
    },
    orderBy: { id: "asc" },
    take: 5,
  }),
});

const main = async () => {
  await ensureReportsDir();

  const report = {
    generatedAt: new Date().toISOString(),
    database: process.env.LEGACY_SQLITE_DATABASE_URL ?? "file:./dev.db",
    counts: await collectCounts(),
    orphanChecks: await countOrphans(),
    samples: await collectSamples(),
    migrationOrder: [
      "User",
      "RefreshToken",
      "Address",
      "RestaurantCategory",
      "Cuisine",
      "Offer",
      "Restaurant",
      "OperationsRegionNote",
      "RestaurantCategoryMap",
      "RestaurantCuisine",
      "RestaurantHour",
      "MenuCategory",
      "MenuItem",
      "Combo",
      "ComboItem",
      "ItemAddon",
      "RestaurantOffer",
      "SavedPaymentMethod",
      "DeliveryPartner",
      "DeliveryDocument",
      "FavoriteRestaurant",
      "Reservation",
      "Cart",
      "CartItem",
      "CartItemAddon",
      "Order",
      "OrderItem",
      "OrderItemAddon",
      "Payment",
      "OrderStatusEvent",
      "DeliveryAssignmentOffer",
      "Review",
      "Notification",
    ],
  };

  const reportPath = path.join(reportsDir, "sqlite-analysis.json");
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`SQLite analysis written to ${reportPath}`);
  console.log(JSON.stringify(report.counts, null, 2));
};

main()
  .catch((error) => {
    console.error("SQLite analysis failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await legacy.$disconnect();
  });

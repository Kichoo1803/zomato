import { Router } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { addonsRouter } from "../modules/addons/addons.routes.js";
import { adminAnalyticsRouter } from "../modules/admin-analytics/admin-analytics.routes.js";
import { approvalRequestsRouter } from "../modules/approval-requests/approval-requests.routes.js";
import { addressesRouter } from "../modules/addresses/addresses.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { cartsRouter } from "../modules/carts/carts.routes.js";
import { categoriesRouter } from "../modules/categories/categories.routes.js";
import { combosRouter } from "../modules/combos/combos.routes.js";
import { deliveryPartnersRouter } from "../modules/delivery-partners/delivery-partners.routes.js";
import { favoritesRouter } from "../modules/favorites/favorites.routes.js";
import { geoRouter } from "../modules/geo/geo.routes.js";
import { menuItemsRouter } from "../modules/menu-items/menu-items.routes.js";
import { notificationsRouter } from "../modules/notifications/notifications.routes.js";
import { offersRouter } from "../modules/offers/offers.routes.js";
import { ownerAnalyticsRouter } from "../modules/owner-analytics/owner-analytics.routes.js";
import { ordersRouter } from "../modules/orders/orders.routes.js";
import { operationsRouter } from "../modules/operations/operations.routes.js";
import { paymentsRouter, savedPaymentMethodsRouter } from "../modules/payments/payments.routes.js";
import { registrationApplicationsRouter } from "../modules/registration-applications/registration-applications.routes.js";
import { reservationsRouter } from "../modules/reservations/reservations.routes.js";
import { regionsRouter } from "../modules/regions/regions.routes.js";
import { restaurantsRouter } from "../modules/restaurants/restaurants.routes.js";
import { reviewsRouter } from "../modules/reviews/reviews.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

export const apiRouter = Router();
const fullHealthEnvironmentKeys = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "NODE_ENV",
] as const;

const getFullHealthEnvironmentStatus = () =>
  Object.fromEntries(
    fullHealthEnvironmentKeys.map((key) => [key, Boolean(process.env[key]?.trim())]),
  ) as Record<(typeof fullHealthEnvironmentKeys)[number], boolean>;

const verifyDatabaseConnection = async () => {
  await prisma.$connect();

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

  if (databaseUrl.startsWith("mongodb://") || databaseUrl.startsWith("mongodb+srv://")) {
    await prisma.$runCommandRaw({
      ping: 1,
    });
  }
};

apiRouter.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    message: "pong",
    data: {
      method: req.method,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Zomato Luxe API is healthy",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.get("/health/full", async (req, res) => {
  const environment = getFullHealthEnvironmentStatus();

  try {
    await verifyDatabaseConnection();

    res.status(200).json({
      server: true,
      environment,
      database: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown database connection error";

    logger.error("Full health check database connection failed", {
      path: req.originalUrl,
      method: req.method,
      error: errorMessage,
      stack: env.isProduction ? undefined : error instanceof Error ? error.stack : undefined,
    });

    res.status(503).json({
      server: true,
      environment,
      database: false,
      ...(env.isDevelopment ? { error: errorMessage } : {}),
    });
  }
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/geo", geoRouter);
apiRouter.use("/addresses", addressesRouter);
apiRouter.use("/restaurants", restaurantsRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/menu-items", menuItemsRouter);
apiRouter.use("/combos", combosRouter);
apiRouter.use("/addons", addonsRouter);
apiRouter.use("/carts", cartsRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/saved-payment-methods", savedPaymentMethodsRouter);
apiRouter.use("/offers", offersRouter);
apiRouter.use("/owner", ownerAnalyticsRouter);
apiRouter.use("/operations", operationsRouter);
apiRouter.use("/favorites", favoritesRouter);
apiRouter.use("/reviews", reviewsRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/reservations", reservationsRouter);
apiRouter.use("/delivery-partners", deliveryPartnersRouter);
apiRouter.use("/regions", regionsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/approval-requests", approvalRequestsRouter);
apiRouter.use("/registration-applications", registrationApplicationsRouter);
apiRouter.use("/admin/analytics", adminAnalyticsRouter);

import { Router } from "express";
import { addonsRouter } from "../modules/addons/addons.routes.js";
import { adminAnalyticsRouter } from "../modules/admin-analytics/admin-analytics.routes.js";
import { addressesRouter } from "../modules/addresses/addresses.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { cartsRouter } from "../modules/carts/carts.routes.js";
import { categoriesRouter } from "../modules/categories/categories.routes.js";
import { combosRouter } from "../modules/combos/combos.routes.js";
import { deliveryPartnersRouter } from "../modules/delivery-partners/delivery-partners.routes.js";
import { favoritesRouter } from "../modules/favorites/favorites.routes.js";
import { menuItemsRouter } from "../modules/menu-items/menu-items.routes.js";
import { notificationsRouter } from "../modules/notifications/notifications.routes.js";
import { offersRouter } from "../modules/offers/offers.routes.js";
import { ownerAnalyticsRouter } from "../modules/owner-analytics/owner-analytics.routes.js";
import { ordersRouter } from "../modules/orders/orders.routes.js";
import { operationsRouter } from "../modules/operations/operations.routes.js";
import { paymentsRouter } from "../modules/payments/payments.routes.js";
import { reservationsRouter } from "../modules/reservations/reservations.routes.js";
import { restaurantsRouter } from "../modules/restaurants/restaurants.routes.js";
import { reviewsRouter } from "../modules/reviews/reviews.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

export const apiRouter = Router();

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

apiRouter.use("/auth", authRouter);
apiRouter.use("/addresses", addressesRouter);
apiRouter.use("/restaurants", restaurantsRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/menu-items", menuItemsRouter);
apiRouter.use("/combos", combosRouter);
apiRouter.use("/addons", addonsRouter);
apiRouter.use("/carts", cartsRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/offers", offersRouter);
apiRouter.use("/owner", ownerAnalyticsRouter);
apiRouter.use("/operations", operationsRouter);
apiRouter.use("/favorites", favoritesRouter);
apiRouter.use("/reviews", reviewsRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/reservations", reservationsRouter);
apiRouter.use("/delivery-partners", deliveryPartnersRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/admin/analytics", adminAnalyticsRouter);

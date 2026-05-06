import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, optionalAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  cancelEvent,
  createEvent,
  deleteEvent,
  joinEvent,
  listEvents,
  listEventAttendees,
  listMyEvents,
  listOwnerEvents,
  listRestaurantEvents,
  updateEvent,
} from "./events.controller.js";
import {
  cancelEventSchema,
  createEventSchema,
  eventIdParamSchema,
  joinEventSchema,
  listEventsSchema,
  restaurantEventsParamSchema,
  updateEventSchema,
} from "./events.validation.js";

export const eventsRouter = Router();
export const adminEventsRouter = Router();
export const ownerEventsRouter = Router();

eventsRouter.get("/events", optionalAuth, validate(listEventsSchema), listEvents);
eventsRouter.get("/users/me/events", requireAuth, authorize(Role.CUSTOMER), listMyEvents);
eventsRouter.get(
  "/restaurants/:restaurantId/events",
  optionalAuth,
  validate(restaurantEventsParamSchema),
  listRestaurantEvents,
);
eventsRouter.post(
  "/events/:eventId/join",
  requireAuth,
  authorize(Role.CUSTOMER),
  validate(joinEventSchema),
  joinEvent,
);
eventsRouter.delete(
  "/events/:eventId/cancel",
  requireAuth,
  authorize(Role.CUSTOMER),
  validate(cancelEventSchema),
  cancelEvent,
);

adminEventsRouter.post("/", requireAuth, authorize(Role.ADMIN), validate(createEventSchema), createEvent);
adminEventsRouter.get(
  "/:eventId/attendees",
  requireAuth,
  authorize(Role.ADMIN),
  validate(eventIdParamSchema),
  listEventAttendees,
);
adminEventsRouter.patch(
  "/:eventId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(updateEventSchema),
  updateEvent,
);
adminEventsRouter.delete(
  "/:eventId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(eventIdParamSchema),
  deleteEvent,
);

ownerEventsRouter.get("/", requireAuth, authorize(Role.RESTAURANT_OWNER), listOwnerEvents);

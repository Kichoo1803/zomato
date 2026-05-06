import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, optionalAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createEvent,
  deleteEvent,
  listEvents,
  listRestaurantEvents,
  updateEvent,
} from "./events.controller.js";
import {
  createEventSchema,
  eventIdParamSchema,
  listEventsSchema,
  restaurantEventsParamSchema,
  updateEventSchema,
} from "./events.validation.js";

export const eventsRouter = Router();
export const adminEventsRouter = Router();

eventsRouter.get("/events", optionalAuth, validate(listEventsSchema), listEvents);
eventsRouter.get(
  "/restaurants/:restaurantId/events",
  validate(restaurantEventsParamSchema),
  listRestaurantEvents,
);

adminEventsRouter.post("/", requireAuth, authorize(Role.ADMIN), validate(createEventSchema), createEvent);
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

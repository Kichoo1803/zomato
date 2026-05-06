import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, optionalAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  bookEvent,
  cancelEvent,
  cancelEventBooking,
  createEvent,
  deleteEvent,
  joinEvent,
  listEvents,
  listEventAttendees,
  listMyEvents,
  listOwnerEvents,
  listRestaurantEvents,
  markEventBookingAttended,
  markOwnerEventBookingAttended,
  updateEvent,
} from "./events.controller.js";
import {
  bookEventSchema,
  cancelBookingSchema,
  cancelEventSchema,
  createEventSchema,
  eventIdParamSchema,
  joinEventSchema,
  listEventsSchema,
  markBookingAttendedSchema,
  ownerBookingIdParamSchema,
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
  "/events/:eventId/book",
  requireAuth,
  authorize(Role.CUSTOMER),
  validate(bookEventSchema),
  bookEvent,
);
eventsRouter.post(
  "/events/:eventId/join",
  requireAuth,
  authorize(Role.CUSTOMER),
  validate(joinEventSchema),
  joinEvent,
);
eventsRouter.delete(
  "/event-bookings/:bookingId/cancel",
  requireAuth,
  authorize(Role.CUSTOMER),
  validate(cancelBookingSchema),
  cancelEventBooking,
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
adminEventsRouter.patch(
  "/:eventId/bookings/:bookingId/attend",
  requireAuth,
  authorize(Role.ADMIN),
  validate(markBookingAttendedSchema),
  markEventBookingAttended,
);

ownerEventsRouter.get("/", requireAuth, authorize(Role.RESTAURANT_OWNER), listOwnerEvents);
ownerEventsRouter.patch(
  "/bookings/:bookingId/attend",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(ownerBookingIdParamSchema),
  markOwnerEventBookingAttended,
);

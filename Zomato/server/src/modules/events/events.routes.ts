import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, optionalAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  bookEvent,
  cancelEvent,
  cancelEventBooking,
  createEventTemplateAdmin,
  createEvent,
  createOwnerEventFromTemplate,
  deleteEventTemplateAdmin,
  deleteEvent,
  joinEvent,
  listEventTemplatesAdmin,
  listEvents,
  listEventAttendees,
  listMyEvents,
  listOwnerEvents,
  listOwnerEventTemplates,
  listRestaurantEvents,
  markEventBookingAttended,
  markOwnerEventBookingAttended,
  payEventBooking,
  updateEventBookingRefund,
  updateEventTemplateAdmin,
  updateEvent,
  updateOwnerEventBookingRefund,
  updateOwnerEventStatus,
} from "./events.controller.js";
import {
  bookEventSchema,
  cancelBookingSchema,
  cancelEventSchema,
  createEventTemplateSchema,
  createEventSchema,
  createOwnerEventFromTemplateSchema,
  eventIdParamSchema,
  eventTemplateIdParamSchema,
  joinEventSchema,
  listEventsSchema,
  markBookingAttendedSchema,
  ownerBookingIdParamSchema,
  ownerEventStatusParamSchema,
  payEventBookingSchema,
  restaurantEventsParamSchema,
  updateEventRefundSchema,
  updateEventTemplateSchema,
  updateEventSchema,
  updateOwnerEventRefundSchema,
} from "./events.validation.js";

export const eventsRouter = Router();
export const adminEventsRouter = Router();
export const adminEventTemplatesRouter = Router();
export const ownerEventsRouter = Router();
export const ownerEventTemplatesRouter = Router();

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
eventsRouter.post(
  "/event-bookings/:bookingId/pay",
  requireAuth,
  authorize(Role.CUSTOMER),
  validate(payEventBookingSchema),
  payEventBooking,
);
eventsRouter.post(
  "/event-bookings/:bookingId/cancel",
  requireAuth,
  authorize(Role.CUSTOMER),
  validate(cancelBookingSchema),
  cancelEventBooking,
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
adminEventsRouter.get(
  "/:eventId/bookings",
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
adminEventsRouter.patch(
  "/:eventId/bookings/:bookingId/refund",
  requireAuth,
  authorize(Role.ADMIN),
  validate(updateEventRefundSchema),
  updateEventBookingRefund,
);

adminEventTemplatesRouter.get("/", requireAuth, authorize(Role.ADMIN), listEventTemplatesAdmin);
adminEventTemplatesRouter.post(
  "/",
  requireAuth,
  authorize(Role.ADMIN),
  validate(createEventTemplateSchema),
  createEventTemplateAdmin,
);
adminEventTemplatesRouter.patch(
  "/:id",
  requireAuth,
  authorize(Role.ADMIN),
  validate(updateEventTemplateSchema),
  updateEventTemplateAdmin,
);
adminEventTemplatesRouter.delete(
  "/:id",
  requireAuth,
  authorize(Role.ADMIN),
  validate(eventTemplateIdParamSchema),
  deleteEventTemplateAdmin,
);

ownerEventsRouter.get("/", requireAuth, authorize(Role.RESTAURANT_OWNER), listOwnerEvents);
ownerEventsRouter.post(
  "/from-template",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(createOwnerEventFromTemplateSchema),
  createOwnerEventFromTemplate,
);
ownerEventsRouter.patch(
  "/bookings/:bookingId/attend",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(ownerBookingIdParamSchema),
  markOwnerEventBookingAttended,
);
ownerEventsRouter.patch(
  "/bookings/:bookingId/refund",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(updateOwnerEventRefundSchema),
  updateOwnerEventBookingRefund,
);
ownerEventsRouter.patch(
  "/:eventId/status",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(ownerEventStatusParamSchema),
  updateOwnerEventStatus,
);

ownerEventTemplatesRouter.get("/", requireAuth, authorize(Role.RESTAURANT_OWNER), listOwnerEventTemplates);

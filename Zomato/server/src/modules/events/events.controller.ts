import { Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { eventsService } from "./events.service.js";

export const listEvents = asyncHandler(async (req, res) => {
  const query = {
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    restaurantId: typeof req.query.restaurantId === "number" ? req.query.restaurantId : undefined,
    regionId: typeof req.query.regionId === "number" ? req.query.regionId : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  };
  const events =
    req.user?.role === Role.ADMIN
      ? await eventsService.listAdmin(query)
      : await eventsService.listPublic(query, req.user?.id);

  return sendSuccess(res, {
    message: "Events fetched successfully",
    data: { events },
  });
});

export const listRestaurantEvents = asyncHandler(async (req, res) => {
  const events = await eventsService.listForRestaurantPublic(Number(req.params.restaurantId), req.user?.id);

  return sendSuccess(res, {
    message: "Restaurant events fetched successfully",
    data: { events },
  });
});

export const createEvent = asyncHandler(async (req, res) => {
  const event = await eventsService.create(req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Event created successfully",
    data: { event },
  });
});

export const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventsService.update(Number(req.params.eventId), req.body);

  return sendSuccess(res, {
    message: "Event updated successfully",
    data: { event },
  });
});

export const deleteEvent = asyncHandler(async (req, res) => {
  await eventsService.remove(Number(req.params.eventId));

  return sendSuccess(res, {
    message: "Event deleted successfully",
  });
});

export const listEventTemplatesAdmin = asyncHandler(async (_req, res) => {
  const templates = await eventsService.listTemplatesAdmin();

  return sendSuccess(res, {
    message: "Event templates fetched successfully",
    data: { templates },
  });
});

export const createEventTemplateAdmin = asyncHandler(async (req, res) => {
  const template = await eventsService.createTemplate(req.user!.id, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Event template created successfully",
    data: { template },
  });
});

export const updateEventTemplateAdmin = asyncHandler(async (req, res) => {
  const template = await eventsService.updateTemplate(Number(req.params.id), req.body);

  return sendSuccess(res, {
    message: "Event template updated successfully",
    data: { template },
  });
});

export const deleteEventTemplateAdmin = asyncHandler(async (req, res) => {
  await eventsService.removeTemplate(Number(req.params.id));

  return sendSuccess(res, {
    message: "Event template deleted successfully",
  });
});

export const bookEvent = asyncHandler(async (req, res) => {
  const result = await eventsService.book(req.user!.id, Number(req.params.eventId), req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Event booking created successfully",
    data: result,
  });
});

export const payEventBooking = asyncHandler(async (req, res) => {
  const result = await eventsService.pay(req.user!.id, Number(req.params.bookingId), req.body);

  return sendSuccess(res, {
    message: "Event booking confirmed successfully",
    data: result,
  });
});

export const joinEvent = asyncHandler(async (req, res) => {
  const result = await eventsService.join(
    req.user!.id,
    Number(req.params.eventId),
    Number(req.body.restaurantId),
  );

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Event booking confirmed successfully",
    data: result,
  });
});

export const cancelEventBooking = asyncHandler(async (req, res) => {
  const result = await eventsService.cancelBooking(req.user!.id, Number(req.params.bookingId));

  return sendSuccess(res, {
    message: "Event booking cancelled successfully",
    data: result,
  });
});

export const cancelEvent = asyncHandler(async (req, res) => {
  const result = await eventsService.cancel(req.user!.id, Number(req.params.eventId));

  return sendSuccess(res, {
    message: "Event booking cancelled successfully",
    data: result,
  });
});

export const listMyEvents = asyncHandler(async (req, res) => {
  const events = await eventsService.listMyEvents(req.user!.id);

  return sendSuccess(res, {
    message: "Your event bookings fetched successfully",
    data: { events },
  });
});

export const getMyEventBooking = asyncHandler(async (req, res) => {
  const booking = await eventsService.getBookingForUser(req.user!.id, Number(req.params.bookingId));

  return sendSuccess(res, {
    message: "Event booking fetched successfully",
    data: { booking },
  });
});

export const listEventAttendees = asyncHandler(async (req, res) => {
  const attendeeData = await eventsService.listAttendeesForAdmin(Number(req.params.eventId));

  return sendSuccess(res, {
    message: "Event bookings fetched successfully",
    data: attendeeData,
  });
});

export const markEventBookingAttended = asyncHandler(async (req, res) => {
  const result = await eventsService.markBookingAttendedForAdmin(
    Number(req.params.eventId),
    Number(req.params.bookingId),
  );

  return sendSuccess(res, {
    message: "Event booking marked as attended successfully",
    data: result,
  });
});

export const updateEventBookingRefund = asyncHandler(async (req, res) => {
  const result = await eventsService.updateRefundForAdmin(
    Number(req.params.eventId),
    Number(req.params.bookingId),
    req.body,
  );

  return sendSuccess(res, {
    message: "Event refund updated successfully",
    data: result,
  });
});

export const listOwnerEvents = asyncHandler(async (req, res) => {
  const events = await eventsService.listOwnerParticipation(req.user!.id);

  return sendSuccess(res, {
    message: "Owner event bookings fetched successfully",
    data: { events },
  });
});

export const markOwnerEventBookingAttended = asyncHandler(async (req, res) => {
  const result = await eventsService.markBookingAttendedForOwner(
    req.user!.id,
    Number(req.params.bookingId),
  );

  return sendSuccess(res, {
    message: "Event booking marked as attended successfully",
    data: result,
  });
});

export const updateOwnerEventBookingRefund = asyncHandler(async (req, res) => {
  const result = await eventsService.updateRefundForOwner(
    req.user!.id,
    Number(req.params.bookingId),
    req.body,
  );

  return sendSuccess(res, {
    message: "Event refund updated successfully",
    data: result,
  });
});

export const updateOwnerEventStatus = asyncHandler(async (req, res) => {
  const event = await eventsService.updateEventStatusForOwner(
    req.user!.id,
    Number(req.params.eventId),
    req.body,
  );

  return sendSuccess(res, {
    message: "Event updated successfully",
    data: { event },
  });
});

export const listOwnerEventTemplates = asyncHandler(async (_req, res) => {
  const templates = await eventsService.listTemplatesForOwner();

  return sendSuccess(res, {
    message: "Owner event templates fetched successfully",
    data: { templates },
  });
});

export const createOwnerEventFromTemplate = asyncHandler(async (req, res) => {
  const event = await eventsService.createForOwnerFromTemplate(req.user!.id, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Owner event created successfully",
    data: { event },
  });
});

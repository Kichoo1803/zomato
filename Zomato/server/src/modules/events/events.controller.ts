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

export const joinEvent = asyncHandler(async (req, res) => {
  const result = await eventsService.join(
    req.user!.id,
    Number(req.params.eventId),
    Number(req.body.restaurantId),
  );

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Event joined successfully",
    data: result,
  });
});

export const cancelEvent = asyncHandler(async (req, res) => {
  const result = await eventsService.cancel(req.user!.id, Number(req.params.eventId));

  return sendSuccess(res, {
    message: "Event attendance cancelled successfully",
    data: result,
  });
});

export const listMyEvents = asyncHandler(async (req, res) => {
  const events = await eventsService.listMyEvents(req.user!.id);

  return sendSuccess(res, {
    message: "Your events fetched successfully",
    data: { events },
  });
});

export const listEventAttendees = asyncHandler(async (req, res) => {
  const attendeeData = await eventsService.listAttendeesForAdmin(Number(req.params.eventId));

  return sendSuccess(res, {
    message: "Event attendees fetched successfully",
    data: attendeeData,
  });
});

export const listOwnerEvents = asyncHandler(async (req, res) => {
  const events = await eventsService.listOwnerParticipation(req.user!.id);

  return sendSuccess(res, {
    message: "Owner event participation fetched successfully",
    data: { events },
  });
});

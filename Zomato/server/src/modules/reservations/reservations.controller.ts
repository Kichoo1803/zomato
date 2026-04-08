import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { reservationsService } from "./reservations.service.js";

export const listReservations = asyncHandler(async (req, res) => {
  const reservations = await reservationsService.list(req.user!);

  return sendSuccess(res, {
    message: "Reservations fetched successfully",
    data: { reservations },
  });
});

export const createReservation = asyncHandler(async (req, res) => {
  const reservation = await reservationsService.create(req.user!, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Reservation created successfully",
    data: { reservation },
  });
});

export const updateReservationStatus = asyncHandler(async (req, res) => {
  const reservation = await reservationsService.updateStatus(
    req.user!,
    Number(req.params.reservationId),
    req.body.status,
  );

  return sendSuccess(res, {
    message: "Reservation updated successfully",
    data: { reservation },
  });
});

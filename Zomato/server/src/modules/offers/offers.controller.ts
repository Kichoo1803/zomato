import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { offersService } from "./offers.service.js";

export const listOffers = asyncHandler(async (_req, res) => {
  const offers = await offersService.listActive();

  return sendSuccess(res, {
    message: "Offers fetched successfully",
    data: { offers },
  });
});

export const listAllOffers = asyncHandler(async (_req, res) => {
  const offers = await offersService.listAll();

  return sendSuccess(res, {
    message: "All offers fetched successfully",
    data: { offers },
  });
});

export const createOffer = asyncHandler(async (req, res) => {
  const offer = await offersService.create(req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Offer created successfully",
    data: { offer },
  });
});

export const updateOffer = asyncHandler(async (req, res) => {
  const offer = await offersService.update(Number(req.params.offerId), req.body);

  return sendSuccess(res, {
    message: "Offer updated successfully",
    data: { offer },
  });
});

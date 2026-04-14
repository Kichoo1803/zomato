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

export const listOwnerOffers = asyncHandler(async (req, res) => {
  const offers = await offersService.listForOwner(req.user!.id);

  return sendSuccess(res, {
    message: "Owner offers fetched successfully",
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

export const createOwnerOffer = asyncHandler(async (req, res) => {
  const offer = await offersService.createForOwner(req.user!.id, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Owner offer created successfully",
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

export const updateOwnerOffer = asyncHandler(async (req, res) => {
  const offer = await offersService.updateForOwner(req.user!.id, Number(req.params.offerId), req.body);

  return sendSuccess(res, {
    message: "Owner offer updated successfully",
    data: { offer },
  });
});

export const deleteOffer = asyncHandler(async (req, res) => {
  await offersService.remove(Number(req.params.offerId));

  return sendSuccess(res, {
    message: "Offer deleted successfully",
  });
});

export const deleteOwnerOffer = asyncHandler(async (req, res) => {
  await offersService.removeForOwner(req.user!.id, Number(req.params.offerId));

  return sendSuccess(res, {
    message: "Owner offer deleted successfully",
  });
});

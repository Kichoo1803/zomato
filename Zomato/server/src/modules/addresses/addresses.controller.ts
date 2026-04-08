import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { addressesService } from "./addresses.service.js";

export const listAddresses = asyncHandler(async (req, res) => {
  const addresses = await addressesService.list(req.user!.id);

  return sendSuccess(res, {
    message: "Addresses fetched successfully",
    data: { addresses },
  });
});

export const createAddress = asyncHandler(async (req, res) => {
  const address = await addressesService.create(req.user!.id, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Address created successfully",
    data: { address },
  });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const address = await addressesService.update(req.user!.id, Number(req.params.addressId), req.body);

  return sendSuccess(res, {
    message: "Address updated successfully",
    data: { address },
  });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  await addressesService.remove(req.user!.id, Number(req.params.addressId));

  return sendSuccess(res, {
    message: "Address deleted successfully",
  });
});

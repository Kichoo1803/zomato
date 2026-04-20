import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { geoService } from "./geo.service.js";

export const geocodeAddress = asyncHandler(async (req, res) => {
  const location = await geoService.geocodeAddress(String(req.query.query));

  return sendSuccess(res, {
    message: "Address resolved successfully",
    data: { location },
  });
});

export const reverseGeocode = asyncHandler(async (req, res) => {
  const location = await geoService.reverseGeocode(
    Number(req.query.latitude),
    Number(req.query.longitude),
  );

  return sendSuccess(res, {
    message: "Location resolved successfully",
    data: { location },
  });
});

import { StatusCodes } from "http-status-codes";
import { AppError } from "../../utils/app-error.js";
import { resolveAddressText, reverseGeocodeCoordinates } from "../../utils/geo.js";

export const geoService = {
  async geocodeAddress(query: string) {
    const location = await resolveAddressText(query);

    if (!location) {
      throw new AppError(StatusCodes.NOT_FOUND, "Unable to resolve that address", "ADDRESS_LOOKUP_FAILED");
    }

    return location;
  },

  async reverseGeocode(latitude: number, longitude: number) {
    const location = await reverseGeocodeCoordinates(latitude, longitude);

    if (!location) {
      throw new AppError(StatusCodes.NOT_FOUND, "Unable to resolve that location", "LOCATION_LOOKUP_FAILED");
    }

    return location;
  },
};

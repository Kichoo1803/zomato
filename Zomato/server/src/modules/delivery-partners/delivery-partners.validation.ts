import { DeliveryAvailabilityStatus } from "../../constants/enums.js";
import { z } from "zod";

export const updateAvailabilitySchema = {
  body: z.object({
    availabilityStatus: z.enum([
      DeliveryAvailabilityStatus.ONLINE,
      DeliveryAvailabilityStatus.OFFLINE,
      DeliveryAvailabilityStatus.BUSY,
    ]),
  }),
};

export const updateLocationSchema = {
  body: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
};

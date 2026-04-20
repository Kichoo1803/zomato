import { z } from "zod";

export const geocodeAddressSchema = {
  query: z.object({
    query: z.string().trim().min(3).max(240),
  }),
};

export const reverseGeocodeSchema = {
  query: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }),
};

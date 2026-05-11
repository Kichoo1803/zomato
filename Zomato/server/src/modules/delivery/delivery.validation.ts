import { z } from "zod";

export const deliveryAvailabilityQuerySchema = {
  query: z.object({
    restaurantId: z.coerce.number().int().positive(),
    addressId: z.coerce.number().int().positive().optional(),
  }),
};

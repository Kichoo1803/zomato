import { z } from "zod";

export const paymentOrderQuerySchema = {
  query: z.object({
    orderId: z.coerce.number().int().positive().optional(),
  }),
};

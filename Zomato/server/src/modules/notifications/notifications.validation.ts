import { z } from "zod";

export const notificationIdParamSchema = {
  params: z.object({
    notificationId: z.coerce.number().int().positive(),
  }),
};

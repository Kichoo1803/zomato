import { z } from "zod";

export const getAdminDashboardQuerySchema = {
  query: z.object({
    regionId: z.coerce.number().int().positive().optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
      .optional(),
  }),
};

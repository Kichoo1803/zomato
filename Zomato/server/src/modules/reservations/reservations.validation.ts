import { ReservationStatus } from "../../constants/enums.js";
import { z } from "zod";

export const createReservationSchema = {
  body: z.object({
    restaurantId: z.coerce.number().int().positive(),
    reservationDate: z.coerce.date(),
    guests: z.coerce.number().int().positive().max(20),
    slot: z.string().trim().min(2).max(50),
    specialRequest: z.string().trim().max(500).optional(),
    contactPhone: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  }),
};

export const reservationIdParamSchema = {
  params: z.object({
    reservationId: z.coerce.number().int().positive(),
  }),
};

export const updateReservationStatusSchema = {
  params: z.object({
    reservationId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.nativeEnum(ReservationStatus),
  }),
};

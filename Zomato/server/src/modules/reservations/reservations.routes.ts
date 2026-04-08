import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createReservation,
  listReservations,
  updateReservationStatus,
} from "./reservations.controller.js";
import {
  createReservationSchema,
  updateReservationStatusSchema,
} from "./reservations.validation.js";

export const reservationsRouter = Router();

reservationsRouter.use(requireAuth);
reservationsRouter.get("/", listReservations);
reservationsRouter.post("/", validate(createReservationSchema), createReservation);
reservationsRouter.patch("/:reservationId/status", validate(updateReservationStatusSchema), updateReservationStatus);

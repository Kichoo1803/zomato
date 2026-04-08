import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createOffer, listAllOffers, listOffers, updateOffer } from "./offers.controller.js";
import { createOfferSchema, updateOfferSchema } from "./offers.validation.js";

export const offersRouter = Router();

offersRouter.get("/", listOffers);
offersRouter.get("/admin/all", requireAuth, authorize(Role.ADMIN), listAllOffers);
offersRouter.post("/", requireAuth, authorize(Role.ADMIN), validate(createOfferSchema), createOffer);
offersRouter.patch("/:offerId", requireAuth, authorize(Role.ADMIN), validate(updateOfferSchema), updateOffer);

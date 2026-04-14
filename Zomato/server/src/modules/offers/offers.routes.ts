import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createOffer,
  createOwnerOffer,
  deleteOffer,
  deleteOwnerOffer,
  listAllOffers,
  listOffers,
  listOwnerOffers,
  updateOffer,
  updateOwnerOffer,
} from "./offers.controller.js";
import {
  createOfferSchema,
  createOwnerOfferSchema,
  offerIdParamSchema,
  updateOfferSchema,
  updateOwnerOfferSchema,
} from "./offers.validation.js";

export const offersRouter = Router();

offersRouter.get("/", listOffers);
offersRouter.get("/admin/all", requireAuth, authorize(Role.ADMIN), listAllOffers);
offersRouter.get("/owner/mine", requireAuth, authorize(Role.RESTAURANT_OWNER), listOwnerOffers);
offersRouter.post("/", requireAuth, authorize(Role.ADMIN), validate(createOfferSchema), createOffer);
offersRouter.post(
  "/owner",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(createOwnerOfferSchema),
  createOwnerOffer,
);
offersRouter.patch("/:offerId", requireAuth, authorize(Role.ADMIN), validate(updateOfferSchema), updateOffer);
offersRouter.patch(
  "/owner/:offerId",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(updateOwnerOfferSchema),
  updateOwnerOffer,
);
offersRouter.delete("/:offerId", requireAuth, authorize(Role.ADMIN), validate(offerIdParamSchema), deleteOffer);
offersRouter.delete(
  "/owner/:offerId",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(offerIdParamSchema),
  deleteOwnerOffer,
);

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createAddress, deleteAddress, listAddresses, updateAddress } from "./addresses.controller.js";
import { addressIdParamSchema, createAddressSchema, updateAddressSchema } from "./addresses.validation.js";

export const addressesRouter = Router();

addressesRouter.use(requireAuth);
addressesRouter.get("/", listAddresses);
addressesRouter.post("/", validate(createAddressSchema), createAddress);
addressesRouter.patch("/:addressId", validate(updateAddressSchema), updateAddress);
addressesRouter.delete("/:addressId", validate(addressIdParamSchema), deleteAddress);

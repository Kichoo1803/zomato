import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { geocodeAddress, reverseGeocode } from "./geo.controller.js";
import { geocodeAddressSchema, reverseGeocodeSchema } from "./geo.validation.js";

export const geoRouter = Router();

geoRouter.get("/search", validate(geocodeAddressSchema), geocodeAddress);
geoRouter.get("/reverse", validate(reverseGeocodeSchema), reverseGeocode);

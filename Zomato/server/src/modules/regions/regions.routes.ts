import { Router } from "express";
import { Role } from "../../constants/enums.js";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createRegion, listRegions, updateRegion } from "./regions.controller.js";
import { createRegionSchema, listRegionsQuerySchema, updateRegionSchema } from "./regions.validation.js";

export const regionsRouter = Router();

regionsRouter.use(requireAuth, authorize(Role.ADMIN));
regionsRouter.get("/", validate(listRegionsQuerySchema), listRegions);
regionsRouter.post("/", validate(createRegionSchema), createRegion);
regionsRouter.patch("/:regionId", validate(updateRegionSchema), updateRegion);

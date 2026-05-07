import { Router } from "express";
import { Role } from "../../constants/enums.js";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createRegion,
  deleteRegion,
  getRegionDetails,
  listRegions,
  updateRegion,
} from "./regions.controller.js";
import {
  createRegionSchema,
  listRegionsQuerySchema,
  regionIdParamSchema,
  updateRegionSchema,
} from "./regions.validation.js";

export const regionsRouter = Router();

regionsRouter.use(requireAuth, authorize(Role.ADMIN));
regionsRouter.get("/", validate(listRegionsQuerySchema), listRegions);
regionsRouter.post("/", validate(createRegionSchema), createRegion);
regionsRouter.get("/:regionId", validate(regionIdParamSchema), getRegionDetails);
regionsRouter.patch("/:regionId", validate(updateRegionSchema), updateRegion);
regionsRouter.delete("/:regionId", validate(regionIdParamSchema), deleteRegion);

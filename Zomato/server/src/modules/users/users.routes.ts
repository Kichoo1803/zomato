import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { listUsers, updateMyProfile } from "./users.controller.js";
import { listUsersQuerySchema, updateProfileSchema } from "./users.validation.js";

export const usersRouter = Router();

usersRouter.patch("/me", requireAuth, validate(updateProfileSchema), updateMyProfile);
usersRouter.get("/", requireAuth, authorize(Role.ADMIN), validate(listUsersQuerySchema), listUsers);

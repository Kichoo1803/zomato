import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateMyMembership,
  updateMyProfile,
  updateUser,
} from "./users.controller.js";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateMembershipSchema,
  updateProfileSchema,
  updateUserSchema,
  userIdParamSchema,
} from "./users.validation.js";

export const usersRouter = Router();

usersRouter.patch("/me", requireAuth, validate(updateProfileSchema), updateMyProfile);
usersRouter.patch("/me/membership", requireAuth, validate(updateMembershipSchema), updateMyMembership);
usersRouter.get("/", requireAuth, authorize(Role.ADMIN), validate(listUsersQuerySchema), listUsers);
usersRouter.post("/", requireAuth, authorize(Role.ADMIN), validate(createUserSchema), createUser);
usersRouter.get("/:userId", requireAuth, authorize(Role.ADMIN), validate(userIdParamSchema), getUserById);
usersRouter.patch("/:userId", requireAuth, authorize(Role.ADMIN), validate(updateUserSchema), updateUser);
usersRouter.delete("/:userId", requireAuth, authorize(Role.ADMIN), validate(userIdParamSchema), deleteUser);

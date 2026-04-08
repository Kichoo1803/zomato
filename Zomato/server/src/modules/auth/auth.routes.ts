import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { getMe, login, logout, refresh, register } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, getMe);

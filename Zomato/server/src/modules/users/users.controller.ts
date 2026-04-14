import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { usersService } from "./users.service.js";

export const listUsers = asyncHandler(async (req, res) => {
  const users = await usersService.list({
    role: req.query.role as never,
    search: req.query.search as string | undefined,
    isActive: typeof req.query.isActive === "boolean" ? req.query.isActive : undefined,
  });

  return sendSuccess(res, {
    message: "Users fetched successfully",
    data: { users },
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await usersService.getById(Number(req.params.userId));

  return sendSuccess(res, {
    message: "User fetched successfully",
    data: { user },
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const user = await usersService.create(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "User created successfully",
    data: { user },
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await usersService.updateByAdmin(Number(req.params.userId), req.body);

  return sendSuccess(res, {
    message: "User updated successfully",
    data: { user },
  });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await usersService.deactivate(req.user!.id, Number(req.params.userId));

  return sendSuccess(res, {
    message: "User disabled successfully",
    data: { user },
  });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const user = await usersService.updateProfile(req.user!.id, req.body);

  return sendSuccess(res, {
    message: "Profile updated successfully",
    data: { user },
  });
});

export const updateMyMembership = asyncHandler(async (req, res) => {
  const user = await usersService.updateMembership(req.user!, req.body);

  return sendSuccess(res, {
    message: "Membership updated successfully",
    data: { user },
  });
});

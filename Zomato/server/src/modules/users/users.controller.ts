import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { usersService } from "./users.service.js";

export const listUsers = asyncHandler(async (req, res) => {
  const users = await usersService.list(req.query.role as never);

  return sendSuccess(res, {
    message: "Users fetched successfully",
    data: { users },
  });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const user = await usersService.updateProfile(req.user!.id, req.body);

  return sendSuccess(res, {
    message: "Profile updated successfully",
    data: { user },
  });
});

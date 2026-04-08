import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/app-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      StatusCodes.NOT_FOUND,
      `Route ${req.method} ${req.originalUrl} was not found`,
      "ROUTE_NOT_FOUND",
    ),
  );
};

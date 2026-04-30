import type { Request } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import { getPrismaRuntimeErrorResponse } from "../../utils/prisma-runtime-errors.js";
import { cartsService } from "./carts.service.js";

const isPrismaKnownRequestError = (
  error: unknown,
): error is Error & { code: string } =>
  error instanceof Error &&
  error.name === "PrismaClientKnownRequestError" &&
  typeof (error as { code?: unknown }).code === "string";

const resolveCartErrorDetails = (error: unknown) => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    };
  }

  const prismaRuntimeError = getPrismaRuntimeErrorResponse(error, {
    isDevelopment: env.isDevelopment,
  });

  if (prismaRuntimeError) {
    return prismaRuntimeError;
  }

  if (isPrismaKnownRequestError(error)) {
    if (error.code === "P2002") {
      return {
        statusCode: StatusCodes.CONFLICT,
        code: error.code,
        message: "A unique field conflict occurred",
      };
    }

    if (["P2021", "P2022"].includes(error.code)) {
      return {
        statusCode: StatusCodes.SERVICE_UNAVAILABLE,
        code: error.code,
        message: env.isDevelopment
          ? "The database schema is out of date. Run `npm run prisma:push` and `npm run prisma:generate`, then restart the server."
          : "The database is not ready to serve this request yet.",
      };
    }

    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      code: "DATABASE_REQUEST_FAILED",
      message: env.isDevelopment
        ? `A database request failed with Prisma error ${error.code}.`
        : "The database could not complete this request right now.",
    };
  }

  return {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : "Unknown error",
  };
};

const logCartRouteError = (req: Request, error: unknown) => {
  const { statusCode, code, message } = resolveCartErrorDetails(error);
  const logLevel = statusCode >= StatusCodes.INTERNAL_SERVER_ERROR ? "error" : "warn";

  logger[logLevel]("Cart route failed", {
    method: req.method,
    endpoint: req.originalUrl,
    statusCode,
    code,
    message,
    userId: req.user?.id,
    restaurantId:
      typeof req.body?.restaurantId === "number" ? req.body.restaurantId : undefined,
    menuItemId: typeof req.body?.menuItemId === "number" ? req.body.menuItemId : undefined,
    comboId: typeof req.body?.comboId === "number" ? req.body.comboId : undefined,
    cartId:
      typeof req.params?.cartId === "string" ? Number(req.params.cartId) : undefined,
    cartItemId:
      typeof req.params?.cartItemId === "string" ? Number(req.params.cartItemId) : undefined,
  });
};

export const listCarts = asyncHandler(async (req, res) => {
  const carts = await cartsService.list(req.user!.id);

  return sendSuccess(res, {
    message: "Carts fetched successfully",
    data: { carts },
  });
});

export const addCartItem = asyncHandler(async (req, res) => {
  try {
    const cart = await cartsService.addItem(req.user!.id, req.body);

    return sendSuccess(res, {
      statusCode: StatusCodes.CREATED,
      message: "Item added to cart",
      data: { cart },
    });
  } catch (error) {
    logCartRouteError(req, error);
    throw error;
  }
});

export const updateCartItem = asyncHandler(async (req, res) => {
  try {
    const cart = await cartsService.updateItem(req.user!.id, Number(req.params.cartItemId), req.body);

    return sendSuccess(res, {
      message: "Cart updated successfully",
      data: { cart },
    });
  } catch (error) {
    logCartRouteError(req, error);
    throw error;
  }
});

export const removeCartItem = asyncHandler(async (req, res) => {
  try {
    const cart = await cartsService.removeItem(req.user!.id, Number(req.params.cartItemId));

    return sendSuccess(res, {
      message: "Cart item removed successfully",
      data: { cart },
    });
  } catch (error) {
    logCartRouteError(req, error);
    throw error;
  }
});

export const applyCartOffer = asyncHandler(async (req, res) => {
  try {
    const cart = await cartsService.applyOffer(req.user!.id, Number(req.params.cartId), req.body.code);

    return sendSuccess(res, {
      message: "Offer applied successfully",
      data: { cart },
    });
  } catch (error) {
    logCartRouteError(req, error);
    throw error;
  }
});

export const removeCartOffer = asyncHandler(async (req, res) => {
  try {
    const cart = await cartsService.removeOffer(req.user!.id, Number(req.params.cartId));

    return sendSuccess(res, {
      message: "Offer removed successfully",
      data: { cart },
    });
  } catch (error) {
    logCartRouteError(req, error);
    throw error;
  }
});

export const clearCart = asyncHandler(async (req, res) => {
  try {
    await cartsService.clearCart(req.user!.id, Number(req.params.cartId));

    return sendSuccess(res, {
      message: "Cart cleared successfully",
    });
  } catch (error) {
    logCartRouteError(req, error);
    throw error;
  }
});

import type { Response } from "express";

export const sendSuccess = <T>(
  res: Response,
  {
    statusCode = 200,
    message,
    data,
  }: {
    statusCode?: number;
    message: string;
    data?: T;
  },
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

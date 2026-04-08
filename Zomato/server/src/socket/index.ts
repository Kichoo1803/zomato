import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

let io: Server | null = null;

export const createSocketServer = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [env.CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const rawUserId = socket.handshake.auth.userId ?? socket.handshake.query.userId;
    const userId = Number(rawUserId);

    if (!Number.isNaN(userId) && userId > 0) {
      socket.join(`user:${userId}`);
    }

    socket.on("join:order", (orderId: string | number) => {
      socket.join(`order:${orderId}`);
    });

    socket.on("leave:order", (orderId: string | number) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on(
      "delivery:location",
      (payload: { orderId: string | number; latitude: number; longitude: number }) => {
        io?.to(`order:${payload.orderId}`).emit("delivery:location:update", {
          ...payload,
          timestamp: new Date().toISOString(),
        });
      },
    );

    socket.on("disconnect", () => {
      logger.info("Socket disconnected", { socketId: socket.id });
    });
  });

  return io;
};

export const getSocketServer = () => io;

export const emitOrderStatusUpdate = (payload: {
  orderId: number;
  userId?: number;
  status: string;
  note?: string;
}) => {
  if (!io) {
    return;
  }

  io.to(`order:${payload.orderId}`).emit("order:status:update", payload);

  if (payload.userId) {
    io.to(`user:${payload.userId}`).emit("order:status:update", payload);
  }
};

export const emitNotification = (userId: number, payload: Record<string, unknown>) => {
  io?.to(`user:${userId}`).emit("notification:new", payload);
};

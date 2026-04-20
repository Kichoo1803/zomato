import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { isAllowedClientOrigin } from "../config/client-origins.js";
import { logger } from "../lib/logger.js";

let io: Server | null = null;

const getUserRoomNames = (payload: Record<string, unknown>) =>
  [
    payload.userId,
    payload.ownerId,
    payload.deliveryPartnerUserId,
  ]
    .map((value) => Number(value))
    .filter((value, index, values) => Number.isInteger(value) && value > 0 && values.indexOf(value) === index)
    .map((userId) => `user:${userId}`);

const emitToRooms = (
  event: string,
  roomNames: Array<string | null | undefined>,
  payload: Record<string, unknown>,
) => {
  if (!io) {
    return;
  }

  const uniqueRoomNames = [...new Set(roomNames.filter((value): value is string => Boolean(value?.trim())))];
  const [firstRoom, ...restRooms] = uniqueRoomNames;

  if (!firstRoom) {
    return;
  }

  let emitter = io.to(firstRoom);
  restRooms.forEach((roomName) => {
    emitter = emitter.to(roomName);
  });

  emitter.emit(event, payload);
};

export const createSocketServer = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isAllowedClientOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin is not allowed by CORS"));
      },
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
  ownerId?: number;
  deliveryPartnerUserId?: number;
  status: string;
  note?: string;
}) => {
  if (!io) {
    return;
  }

  emitToRooms(
    "order:status:update",
    [`order:${payload.orderId}`, ...getUserRoomNames(payload)],
    payload,
  );
};

export const emitDeliveryLocationUpdate = (payload: {
  orderId: number;
  latitude: number;
  longitude: number;
  userId?: number;
  ownerId?: number;
  deliveryPartnerUserId?: number;
  timestamp?: string;
}) => {
  if (!io) {
    return;
  }

  const nextPayload = {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };

  emitToRooms(
    "delivery:location:update",
    [`order:${payload.orderId}`, ...getUserRoomNames(nextPayload)],
    nextPayload,
  );
};

export const emitNotification = (userId: number, payload: Record<string, unknown>) => {
  io?.to(`user:${userId}`).emit("notification:new", payload);
};

export const emitDispatchQueueUpdate = (payload: {
  orderId: number;
  state: string;
  userIds: number[];
}) => {
  if (!io || !payload.userIds.length) {
    return;
  }

  emitToRooms(
    "delivery:dispatch:update",
    payload.userIds.map((userId) => `user:${userId}`),
    payload,
  );
};

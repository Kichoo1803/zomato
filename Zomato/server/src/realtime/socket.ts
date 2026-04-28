import type { Server as HttpServer } from "node:http";
import { Role } from "../constants/enums.js";
import { Server, type Socket } from "socket.io";
import { validateCorsOrigin } from "../config/cors.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { normalizeRoleValue } from "../utils/roles.js";

type SocketAuthContext = {
  userId: number;
  role: Role;
  regionIds: number[];
  restaurantIds: number[];
  deliveryPartnerId: number | null;
};

type NotificationRoomTargets = {
  userId?: number | null;
  userIds?: Array<number | null | undefined>;
  role?: string | null;
  regionId?: number | null;
  regionIds?: Array<number | null | undefined>;
  restaurantId?: number | null;
  restaurantIds?: Array<number | null | undefined>;
  deliveryPartnerId?: number | null;
  deliveryPartnerIds?: Array<number | null | undefined>;
};

type EmitNotificationInput = NotificationRoomTargets & {
  notification: Record<string, unknown>;
};

type OrderStatusUpdatePayload = {
  orderId: number;
  userId?: number;
  ownerId?: number;
  deliveryPartnerUserId?: number;
  restaurantId?: number;
  deliveryPartnerId?: number | null;
  status: string;
  note?: string;
};

type DeliveryLocationUpdatePayload = {
  orderId: number;
  latitude: number;
  longitude: number;
  userId?: number;
  ownerId?: number;
  deliveryPartnerUserId?: number;
  restaurantId?: number;
  deliveryPartnerId?: number | null;
  timestamp?: string;
};

type DispatchQueueUpdatePayload = {
  orderId: number;
  state: string;
  userIds: number[];
  deliveryPartnerIds?: number[];
};

let io: Server | null = null;

const getHandshakeString = (value: unknown) => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }

  return typeof value === "string" ? value : null;
};

const normalizeNumericIds = (values: Array<number | null | undefined>) =>
  [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];

const getUserRoomNames = (payload: {
  userId?: number;
  ownerId?: number;
  deliveryPartnerUserId?: number;
}) =>
  normalizeNumericIds([payload.userId, payload.ownerId, payload.deliveryPartnerUserId]).map(
    (userId) => `user:${userId}`,
  );

const getNotificationRoomNames = (targets: NotificationRoomTargets) => {
  const roomNames = [
    ...normalizeNumericIds([targets.userId, ...(targets.userIds ?? [])]).map((userId) => `user:${userId}`),
    ...normalizeNumericIds([targets.regionId, ...(targets.regionIds ?? [])]).map((regionId) => `region:${regionId}`),
    ...normalizeNumericIds([targets.restaurantId, ...(targets.restaurantIds ?? [])]).map(
      (restaurantId) => `restaurant:${restaurantId}`,
    ),
    ...normalizeNumericIds([targets.deliveryPartnerId, ...(targets.deliveryPartnerIds ?? [])]).map(
      (deliveryPartnerId) => `delivery:${deliveryPartnerId}`,
    ),
  ];

  const normalizedRole = targets.role?.trim().toUpperCase();
  if (normalizedRole === Role.ADMIN) {
    roomNames.push("role:admin");
  }

  return [...new Set(roomNames)];
};

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

  try {
    let emitter = io.to(firstRoom);
    restRooms.forEach((roomName) => {
      emitter = emitter.to(roomName);
    });

    emitter.emit(event, payload);
  } catch (error) {
    logger.error("Realtime emit failed", {
      event,
      error: error instanceof Error ? error.message : "Unknown realtime emit error",
      roomNames: uniqueRoomNames,
    });
  }
};

const getSocketAuthContext = (socket: Socket) =>
  (socket.data as { authContext?: SocketAuthContext }).authContext ?? null;

const extractAccessToken = (socket: Socket) => {
  const handshakeTokenCandidates = [
    getHandshakeString(socket.handshake.auth?.token),
    getHandshakeString(socket.handshake.auth?.accessToken),
    getHandshakeString(socket.handshake.query.token),
  ];

  for (const candidate of handshakeTokenCandidates) {
    if (!candidate?.trim()) {
      continue;
    }

    return candidate.startsWith("Bearer ") ? candidate.slice(7).trim() : candidate.trim();
  }

  const authorizationHeader = getHandshakeString(socket.handshake.headers.authorization);
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice(7).trim();
};

const loadSocketAuthContext = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      regionId: true,
      ownedRestaurants: {
        select: {
          id: true,
        },
      },
      deliveryProfile: {
        select: {
          id: true,
        },
      },
      managedRegions: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user?.isActive) {
    return null;
  }

  const role = normalizeRoleValue(user.role);
  if (!role) {
    return null;
  }

  return {
    userId: user.id,
    role,
    regionIds: normalizeNumericIds([user.regionId, ...user.managedRegions.map((region) => region.id)]),
    restaurantIds: normalizeNumericIds(user.ownedRestaurants.map((restaurant) => restaurant.id)),
    deliveryPartnerId: user.deliveryProfile?.id ?? null,
  } satisfies SocketAuthContext;
};

const joinScopedRooms = (socket: Socket, authContext: SocketAuthContext) => {
  const roomNames = [
    `user:${authContext.userId}`,
    ...(authContext.role === Role.ADMIN ? ["role:admin"] : []),
    ...authContext.regionIds.map((regionId) => `region:${regionId}`),
    ...authContext.restaurantIds.map((restaurantId) => `restaurant:${restaurantId}`),
    ...(authContext.deliveryPartnerId ? [`delivery:${authContext.deliveryPartnerId}`] : []),
  ];

  roomNames.forEach((roomName) => {
    socket.join(roomName);
  });

  return roomNames;
};

const canAccessOrderRoom = async (authContext: SocketAuthContext, orderId: number) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
    },
    select: {
      userId: true,
      deliveryPartnerId: true,
      restaurant: {
        select: {
          id: true,
          ownerId: true,
          regionId: true,
        },
      },
    },
  });

  if (!order) {
    return false;
  }

  if (authContext.role === Role.ADMIN) {
    return true;
  }

  if (authContext.role === Role.CUSTOMER) {
    return order.userId === authContext.userId;
  }

  if (authContext.role === Role.RESTAURANT_OWNER) {
    return (
      order.restaurant.ownerId === authContext.userId ||
      authContext.restaurantIds.includes(order.restaurant.id)
    );
  }

  if (authContext.role === Role.DELIVERY_PARTNER) {
    return (
      authContext.deliveryPartnerId != null &&
      order.deliveryPartnerId === authContext.deliveryPartnerId
    );
  }

  if (authContext.role === Role.REGIONAL_MANAGER) {
    return (
      order.restaurant.regionId != null &&
      authContext.regionIds.includes(order.restaurant.regionId)
    );
  }

  return false;
};

export const initSocket = (httpServer: HttpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: validateCorsOrigin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = extractAccessToken(socket);
      if (!token) {
        next(new Error("Authentication required"));
        return;
      }

      const payload = verifyAccessToken(token);
      const userId = Number(payload.sub);

      if (!Number.isInteger(userId) || userId <= 0 || payload.type !== "access") {
        next(new Error("Invalid access token"));
        return;
      }

      const authContext = await loadSocketAuthContext(userId);
      if (!authContext) {
        next(new Error("Authentication failed"));
        return;
      }

      (socket.data as { authContext?: SocketAuthContext }).authContext = authContext;
      next();
    } catch (error) {
      logger.warn("Socket authentication failed", {
        socketId: socket.id,
        error: error instanceof Error ? error.message : "Unknown socket authentication error",
      });
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const authContext = getSocketAuthContext(socket);

    if (!authContext) {
      socket.disconnect(true);
      return;
    }

    const joinedRooms = joinScopedRooms(socket, authContext);

    logger.info("Socket connected", {
      socketId: socket.id,
      userId: authContext.userId,
      roomCount: joinedRooms.length,
    });

    socket.on("join:order", async (rawOrderId: string | number) => {
      const orderId = Number(rawOrderId);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return;
      }

      try {
        if (await canAccessOrderRoom(authContext, orderId)) {
          socket.join(`order:${orderId}`);
        }
      } catch (error) {
        logger.warn("Failed to join order room", {
          socketId: socket.id,
          userId: authContext.userId,
          orderId,
          error: error instanceof Error ? error.message : "Unknown order room error",
        });
      }
    });

    socket.on("leave:order", (rawOrderId: string | number) => {
      const orderId = Number(rawOrderId);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return;
      }

      socket.leave(`order:${orderId}`);
    });

    socket.on(
      "delivery:location",
      async (payload: { orderId: string | number; latitude: number; longitude: number }) => {
        const orderId = Number(payload.orderId);

        if (
          authContext.role !== Role.ADMIN &&
          authContext.role !== Role.DELIVERY_PARTNER
        ) {
          return;
        }

        if (!Number.isInteger(orderId) || orderId <= 0) {
          return;
        }

        try {
          if (!(await canAccessOrderRoom(authContext, orderId))) {
            return;
          }

          emitToRooms(
            "delivery:location:update",
            [`order:${orderId}`],
            {
              ...payload,
              orderId,
              timestamp: new Date().toISOString(),
            },
          );
        } catch (error) {
          logger.warn("Failed to broadcast delivery location", {
            socketId: socket.id,
            userId: authContext.userId,
            orderId,
            error: error instanceof Error ? error.message : "Unknown delivery location error",
          });
        }
      },
    );

    socket.on("disconnect", () => {
      logger.info("Socket disconnected", {
        socketId: socket.id,
        userId: authContext.userId,
      });
    });
  });

  return io;
};

export const getIO = () => io;

export const emitNotification = (
  targetOrInput: number | EmitNotificationInput,
  notificationPayload?: Record<string, unknown>,
) => {
  if (typeof targetOrInput === "number") {
    emitToRooms("notification:new", [`user:${targetOrInput}`], notificationPayload ?? {});
    return;
  }

  emitToRooms(
    "notification:new",
    getNotificationRoomNames(targetOrInput),
    targetOrInput.notification,
  );
};

export const emitOrderStatusUpdate = (payload: OrderStatusUpdatePayload) => {
  emitToRooms(
    "order:status:update",
    [
      `order:${payload.orderId}`,
      ...getUserRoomNames(payload),
      ...(payload.restaurantId ? [`restaurant:${payload.restaurantId}`] : []),
      ...(payload.deliveryPartnerId ? [`delivery:${payload.deliveryPartnerId}`] : []),
    ],
    payload,
  );
};

export const emitDeliveryLocationUpdate = (payload: DeliveryLocationUpdatePayload) => {
  const nextPayload = {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };

  emitToRooms(
    "delivery:location:update",
    [
      `order:${payload.orderId}`,
      ...getUserRoomNames(nextPayload),
      ...(payload.restaurantId ? [`restaurant:${payload.restaurantId}`] : []),
      ...(payload.deliveryPartnerId ? [`delivery:${payload.deliveryPartnerId}`] : []),
    ],
    nextPayload,
  );
};

export const emitDispatchQueueUpdate = (payload: DispatchQueueUpdatePayload) => {
  emitToRooms(
    "delivery:dispatch:update",
    [
      ...payload.userIds.map((userId) => `user:${userId}`),
      ...(payload.deliveryPartnerIds ?? []).map((deliveryPartnerId) => `delivery:${deliveryPartnerId}`),
    ],
    payload,
  );
};

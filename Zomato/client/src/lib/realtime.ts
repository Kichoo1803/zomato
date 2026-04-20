import { io, type Socket } from "socket.io-client";
import type { AppNotification } from "@/lib/notifications";
import { resolveRealtimeServerUrl } from "@/lib/runtime-urls";

export type RealtimeNotification = AppNotification;

export type RealtimeOrderStatusUpdate = {
  orderId: number;
  userId?: number;
  ownerId?: number;
  deliveryPartnerUserId?: number;
  status: string;
  note?: string;
};

export type RealtimeDeliveryLocationUpdate = {
  orderId: number;
  latitude: number;
  longitude: number;
  userId?: number;
  ownerId?: number;
  deliveryPartnerUserId?: number;
  timestamp: string;
};

export type RealtimeDispatchQueueUpdate = {
  orderId: number;
  state: string;
  userIds: number[];
};

let socket: Socket | null = null;
let socketUserId: number | null = null;

export const getRealtimeSocket = (userId?: number | null) => {
  if (!userId) {
    return null;
  }

  if (socket && socketUserId !== userId) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketUserId = null;
  }

  if (!socket) {
    socket = io(resolveRealtimeServerUrl(), {
      autoConnect: true,
      withCredentials: true,
      auth: {
        userId,
      },
      transports: ["websocket", "polling"],
    });
    socketUserId = userId;
  } else if (!socket.connected) {
    socket.auth = { userId };
    socket.connect();
  }

  return socket;
};

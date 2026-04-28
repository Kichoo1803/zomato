import { io, type Socket } from "socket.io-client";
import type { AppNotification } from "@/lib/notifications";
import { resolveRealtimeServerUrl } from "@/lib/runtime-urls";

export type RealtimeNotification = AppNotification;

export type RealtimeOrderStatusUpdate = {
  orderId: number;
  userId?: number;
  ownerId?: number;
  deliveryPartnerUserId?: number;
  restaurantId?: number;
  deliveryPartnerId?: number | null;
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
  restaurantId?: number;
  deliveryPartnerId?: number | null;
  timestamp: string;
};

export type RealtimeDispatchQueueUpdate = {
  orderId: number;
  state: string;
  userIds: number[];
  deliveryPartnerIds?: number[];
};

let socket: Socket | null = null;
let socketUrl: string | null = null;

const buildSocketAuth = (token: string) => ({
  token: `Bearer ${token}`,
});

const createSocket = (nextSocketUrl: string, token: string) =>
  io(nextSocketUrl, {
    autoConnect: false,
    withCredentials: true,
    auth: buildSocketAuth(token),
    transports: ["websocket", "polling"],
    reconnection: true,
  });

export const connectNotificationSocket = ({ token }: { token: string }) => {
  const nextSocketUrl = resolveRealtimeServerUrl();

  if (!socket || socketUrl !== nextSocketUrl) {
    socket?.disconnect();
    socket = createSocket(nextSocketUrl, token);
    socketUrl = nextSocketUrl;
  } else {
    socket.auth = buildSocketAuth(token);
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const getNotificationSocket = () => socket;

export const updateNotificationSocketAuth = (token: string) => {
  if (!socket) {
    return;
  }

  socket.auth = buildSocketAuth(token);
};

export const disconnectNotificationSocket = () => {
  if (!socket) {
    return;
  }

  socket.disconnect();
};

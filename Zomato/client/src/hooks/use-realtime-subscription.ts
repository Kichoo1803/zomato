import { useEffect, useMemo, useRef } from "react";
import {
  getRealtimeSocket,
  type RealtimeDeliveryLocationUpdate,
  type RealtimeNotification,
  type RealtimeOrderStatusUpdate,
} from "@/lib/realtime";

type UseRealtimeSubscriptionOptions = {
  enabled: boolean;
  userId?: number | null;
  orderIds?: Array<number | null | undefined>;
  onNotification?: (payload: RealtimeNotification) => void;
  onOrderStatusUpdate?: (payload: RealtimeOrderStatusUpdate) => void;
  onDeliveryLocationUpdate?: (payload: RealtimeDeliveryLocationUpdate) => void;
};

const normalizeOrderIds = (orderIds?: Array<number | null | undefined>) =>
  [...new Set((orderIds ?? []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];

export const useRealtimeSubscription = ({
  enabled,
  userId,
  orderIds,
  onNotification,
  onOrderStatusUpdate,
  onDeliveryLocationUpdate,
}: UseRealtimeSubscriptionOptions) => {
  const orderRoomIds = useMemo(() => normalizeOrderIds(orderIds), [orderIds]);
  const notificationHandlerRef = useRef<typeof onNotification>();
  const orderStatusHandlerRef = useRef<typeof onOrderStatusUpdate>();
  const deliveryLocationHandlerRef = useRef<typeof onDeliveryLocationUpdate>();

  useEffect(() => {
    notificationHandlerRef.current = onNotification;
    orderStatusHandlerRef.current = onOrderStatusUpdate;
    deliveryLocationHandlerRef.current = onDeliveryLocationUpdate;
  }, [onDeliveryLocationUpdate, onNotification, onOrderStatusUpdate]);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    const socket = getRealtimeSocket(userId);
    if (!socket) {
      return;
    }

    const handleNotification = (payload: RealtimeNotification) => {
      notificationHandlerRef.current?.(payload);
    };

    const handleOrderStatusUpdate = (payload: RealtimeOrderStatusUpdate) => {
      orderStatusHandlerRef.current?.(payload);
    };

    const handleDeliveryLocationUpdate = (payload: RealtimeDeliveryLocationUpdate) => {
      deliveryLocationHandlerRef.current?.(payload);
    };

    socket.on("notification:new", handleNotification);
    socket.on("order:status:update", handleOrderStatusUpdate);
    socket.on("delivery:location:update", handleDeliveryLocationUpdate);

    orderRoomIds.forEach((orderId) => {
      socket.emit("join:order", orderId);
    });

    return () => {
      socket.off("notification:new", handleNotification);
      socket.off("order:status:update", handleOrderStatusUpdate);
      socket.off("delivery:location:update", handleDeliveryLocationUpdate);

      orderRoomIds.forEach((orderId) => {
        socket.emit("leave:order", orderId);
      });
    };
  }, [enabled, orderRoomIds, userId]);
};

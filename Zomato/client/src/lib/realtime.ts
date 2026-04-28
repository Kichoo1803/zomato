export {
  connectNotificationSocket,
  disconnectNotificationSocket,
  getNotificationSocket as getRealtimeSocket,
  type RealtimeDeliveryLocationUpdate,
  type RealtimeDispatchQueueUpdate,
  type RealtimeNotification,
  type RealtimeOrderStatusUpdate,
  updateNotificationSocketAuth,
} from "@/lib/socket";

import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/api";
import type { UserRole } from "@/types/auth";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

const unwrapData = <T>(response: AxiosResponse<ApiEnvelope<T>>) => response.data.data;

export type AppNotification = {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  meta?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type AppNotificationMeta = {
  eventKey?: string;
  orderId?: number;
  orderNumber?: string;
  status?: string;
  customerName?: string;
  restaurantName?: string;
  itemsSummary?: string;
  itemCount?: number;
  addressSummary?: string;
  pickupSummary?: string;
  deliveryArea?: string;
  totalAmount?: number;
  paymentMethod?: string;
  membershipTier?: string;
  membershipExpiresAt?: string;
  rating?: number;
  reviewId?: number;
  restaurantId?: number;
  offerId?: number;
  count?: number;
  delayedOrdersCount?: number;
  failedPaymentsCount?: number;
  dispatchBacklogCount?: number;
  path?: string;
  estimatedDeliveryMinutes?: number | null;
  routeDistanceKm?: number | null;
  specialInstructions?: string | null;
};

const isDeliveredOrderStatus = (status?: string | null) => status?.trim().toUpperCase() === "DELIVERED";

const isOrderDetailsPath = (path?: string | null) => path?.startsWith("/orders/") ?? false;

export const parseNotificationMeta = (meta?: string | null): AppNotificationMeta | null => {
  if (!meta?.trim()) {
    return null;
  }

  try {
    return JSON.parse(meta) as AppNotificationMeta;
  } catch {
    return null;
  }
};

export const getNotificationHref = (
  role: UserRole,
  notification: Pick<AppNotification, "type" | "meta">,
) => {
  const meta = parseNotificationMeta(notification.meta);

  if (meta?.path) {
    if (role === "CUSTOMER" && meta.orderId && isDeliveredOrderStatus(meta.status)) {
      return `/orders/${meta.orderId}`;
    }

    return meta.path;
  }

  if (meta?.orderId) {
    switch (role) {
      case "CUSTOMER":
        return isDeliveredOrderStatus(meta.status) ? `/orders/${meta.orderId}` : `/track-order/${meta.orderId}`;
      case "RESTAURANT_OWNER":
        return `/owner/orders?orderId=${meta.orderId}`;
      case "DELIVERY_PARTNER":
        return `/delivery/active?orderId=${meta.orderId}`;
      case "REGIONAL_MANAGER":
        return "/ops/assignments";
      case "ADMIN":
        return `/admin/orders?orderId=${meta.orderId}`;
      default:
        return null;
    }
  }

  if (notification.type === "OFFER") {
    switch (role) {
      case "CUSTOMER":
        return "/offers";
      case "RESTAURANT_OWNER":
        return "/owner/offers";
      case "ADMIN":
        return "/admin/offers";
      default:
        return null;
    }
  }

  if (notification.type === "PAYMENT") {
    switch (role) {
      case "CUSTOMER":
        return "/wallet";
      case "ADMIN":
        return "/admin/payments";
      default:
        return null;
    }
  }

  switch (role) {
    case "CUSTOMER":
      return "/notifications";
    case "RESTAURANT_OWNER":
      return "/owner/notifications";
    case "DELIVERY_PARTNER":
      return "/delivery/notifications";
    case "REGIONAL_MANAGER":
      return "/ops/notifications";
    case "ADMIN":
      return "/admin/notifications";
    default:
      return null;
  }
};

export const getNotificationActionLabel = (
  role: UserRole,
  notification: Pick<AppNotification, "type" | "meta">,
) => {
  const meta = parseNotificationMeta(notification.meta);

  if (meta?.orderId) {
    switch (role) {
      case "CUSTOMER":
        return isDeliveredOrderStatus(meta.status) || isOrderDetailsPath(meta.path) ? "View order" : "Track order";
      case "RESTAURANT_OWNER":
        return "Open orders";
      case "DELIVERY_PARTNER":
        return "View delivery";
      case "REGIONAL_MANAGER":
        return "View backlog";
      case "ADMIN":
        return "Open orders";
      default:
        return "Open";
    }
  }

  if (meta?.eventKey?.includes("review")) {
    return "Open reviews";
  }

  if (notification.type === "OFFER") {
    return "Open offers";
  }

  if (notification.type === "PAYMENT") {
    return "Open payments";
  }

  return "Open inbox";
};

export const isReminderNotification = (notification: Pick<AppNotification, "meta">) =>
  parseNotificationMeta(notification.meta)?.eventKey?.startsWith("reminder:") ?? false;

export const getUserNotifications = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ notifications: AppNotification[] }>>("/notifications"))
    .notifications;

export const markUserNotificationRead = async (notificationId: number) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ notification: AppNotification }>>(
      `/notifications/${notificationId}/read`,
    ),
  ).notification;

export const markAllUserNotificationsRead = async () =>
  unwrapData(await apiClient.post<ApiEnvelope<void>>("/notifications/mark-all-read"));

export const deleteAllUserNotifications = async () =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>("/notifications"));

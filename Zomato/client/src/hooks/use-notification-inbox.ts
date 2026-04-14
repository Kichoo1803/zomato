import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/auth";
import {
  deleteAllUserNotifications,
  getUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  type AppNotification,
} from "@/lib/notifications";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";

type UseNotificationInboxOptions = {
  enabled: boolean;
  userId?: number | null;
  onError?: (message: string) => void;
};

type NotificationInboxMutation =
  | {
      kind: "mark-read";
      userId: number;
      notification: AppNotification;
    }
  | {
      kind: "mark-all-read";
      userId: number;
    }
  | {
      kind: "delete-all";
      userId: number;
    };

const notificationInboxListeners = new Set<(mutation: NotificationInboxMutation) => void>();

const emitNotificationInboxMutation = (mutation: NotificationInboxMutation) => {
  notificationInboxListeners.forEach((listener) => listener(mutation));
};

const subscribeToNotificationInboxMutations = (listener: (mutation: NotificationInboxMutation) => void) => {
  notificationInboxListeners.add(listener);

  return () => {
    notificationInboxListeners.delete(listener);
  };
};

export const useNotificationInbox = ({
  enabled,
  userId,
  onError,
}: UseNotificationInboxOptions) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [processingNotificationId, setProcessingNotificationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!enabled || !userId) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!quietly) {
      setIsLoading(true);
    }

    setError(null);

    try {
      setItems(await getUserNotifications());
    } catch (loadError) {
      const message = getApiErrorMessage(loadError, "Unable to load notifications right now.");
      setItems([]);
      setError(message);
      onError?.(message);
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void load();
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    return subscribeToNotificationInboxMutations((mutation) => {
      if (mutation.userId !== userId) {
        return;
      }

      setItems((currentItems) => {
        if (mutation.kind === "mark-read") {
          return currentItems.map((item) =>
            item.id === mutation.notification.id ? mutation.notification : item,
          );
        }

        if (mutation.kind === "mark-all-read") {
          return currentItems.map((item) => ({
            ...item,
            isRead: true,
          }));
        }

        return [];
      });
      setError(null);
    });
  }, [enabled, userId]);

  useRealtimeSubscription({
    enabled,
    userId,
    onNotification: (notification) => {
      setItems((currentItems) => [notification, ...currentItems.filter((item) => item.id !== notification.id)]);
    },
  });

  const markAsRead = async (notificationId: number) => {
    setProcessingNotificationId(notificationId);

    try {
      const updatedNotification = await markUserNotificationRead(notificationId);
      if (userId) {
        emitNotificationInboxMutation({
          kind: "mark-read",
          userId,
          notification: updatedNotification,
        });
      }
      return updatedNotification;
    } catch (markError) {
      const message = getApiErrorMessage(markError, "Unable to mark this notification as read.");
      setError(message);
      onError?.(message);
      throw markError;
    } finally {
      setProcessingNotificationId(null);
    }
  };

  const markAllRead = async () => {
    setIsMarkingAllRead(true);

    try {
      await markAllUserNotificationsRead();
      if (userId) {
        emitNotificationInboxMutation({
          kind: "mark-all-read",
          userId,
        });
      }
    } catch (markError) {
      const message = getApiErrorMessage(markError, "Unable to mark all notifications as read.");
      setError(message);
      onError?.(message);
      throw markError;
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const deleteAll = async () => {
    setIsDeletingAll(true);

    try {
      await deleteAllUserNotifications();
      if (userId) {
        emitNotificationInboxMutation({
          kind: "delete-all",
          userId,
        });
      }
    } catch (deleteError) {
      const message = getApiErrorMessage(deleteError, "Unable to delete all notifications right now.");
      setError(message);
      onError?.(message);
      throw deleteError;
    } finally {
      setIsDeletingAll(false);
    }
  };

  const unreadCount = useMemo(
    () => items.filter((notification) => !notification.isRead).length,
    [items],
  );

  return {
    items,
    isLoading,
    isMarkingAllRead,
    isDeletingAll,
    processingNotificationId,
    error,
    unreadCount,
    hasUnread: unreadCount > 0,
    load,
    markAsRead,
    markAllRead,
    deleteAll,
  };
};

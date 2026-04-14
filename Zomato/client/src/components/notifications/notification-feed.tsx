import { Link } from "react-router-dom";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import {
  getNotificationActionLabel,
  getNotificationHref,
  isReminderNotification,
  type AppNotification,
} from "@/lib/notifications";
import type { UserRole } from "@/types/auth";

const formatNotificationDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

type NotificationFeedProps = {
  items: AppNotification[];
  role: UserRole;
  isLoading: boolean;
  processingNotificationId?: number | null;
  emptyTitle: string;
  emptyDescription: string;
  onMarkAsRead: (notificationId: number) => Promise<unknown>;
};

export const NotificationFeed = ({
  items,
  role,
  isLoading,
  processingNotificationId,
  emptyTitle,
  emptyDescription,
  onMarkAsRead,
}: NotificationFeedProps) => {
  if (isLoading) {
    return (
      <SurfaceCard>
        <p className="text-sm leading-7 text-ink-soft">Loading your notifications.</p>
      </SurfaceCard>
    );
  }

  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid gap-4">
      {items.map((notification) => {
        const href = getNotificationHref(role, notification);
        const actionLabel = getNotificationActionLabel(role, notification);
        const isReminder = isReminderNotification(notification);

        return (
          <SurfaceCard key={notification.id} className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              {isReminder ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-3xl font-semibold text-ink">{notification.title}</p>
                  {isReminder ? <StatusPill label="Reminder" tone="warning" /> : null}
                </div>
                <StatusPill label={notification.isRead ? "Read" : "Unread"} tone={notification.isRead ? "neutral" : "info"} />
              </div>
              <p className="text-sm leading-7 text-ink-soft">{notification.message}</p>
              <div className="flex flex-wrap items-center gap-3">
                {!notification.isRead ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3 py-2 text-xs"
                    disabled={processingNotificationId === notification.id}
                    onClick={() => void onMarkAsRead(notification.id)}
                  >
                    {processingNotificationId === notification.id ? "Saving..." : "Mark as read"}
                  </Button>
                ) : null}
                {href ? (
                  <Link
                    to={href}
                    className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft"
                  >
                    {actionLabel}
                  </Link>
                ) : null}
              </div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">
                {formatNotificationDateTime(notification.createdAt)}
              </p>
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );
};

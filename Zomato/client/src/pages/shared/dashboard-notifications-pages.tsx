import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDangerModal } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import { SectionHeading } from "@/components/ui/page-shell";
import { useNotificationInbox } from "@/hooks/use-notification-inbox";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types/auth";

const DashboardNotificationsPage = ({
  role,
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: {
  role: UserRole;
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}) => {
  const { user } = useAuth();
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const {
    items,
    isLoading,
    unreadCount,
    hasUnread,
    processingNotificationId,
    isMarkingAllRead,
    isDeletingAll,
    markAsRead,
    markAllRead,
    deleteAll,
  } = useNotificationInbox({
    enabled: user?.role === role,
    userId: user?.id,
    onError: (message) => toast.error(message),
  });

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      toast.success("All notifications marked as read.");
    } catch {
      // Errors are already surfaced by the inbox hook.
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAll();
      setIsDeleteAllConfirmOpen(false);
      toast.success("All notifications deleted.");
    } catch {
      // Errors are already surfaced by the inbox hook.
    }
  };

  return (
    <>
      <div className="space-y-8">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={
            items.length ? (
              <>
                {hasUnread ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleMarkAllRead()}
                    disabled={isMarkingAllRead || isDeletingAll}
                  >
                    {isMarkingAllRead ? "Saving..." : "Mark all read"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsDeleteAllConfirmOpen(true)}
                  disabled={isDeletingAll || isMarkingAllRead}
                >
                  Delete all
                </Button>
              </>
            ) : undefined
          }
        />

        <div className="space-y-5">
          <SectionHeading
            title="Notification center"
            description={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} in your live inbox.`}
          />
          <NotificationFeed
            items={items}
            role={role}
            isLoading={isLoading}
            processingNotificationId={processingNotificationId}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            onMarkAsRead={markAsRead}
          />
        </div>
      </div>

      <ConfirmDangerModal
        open={isDeleteAllConfirmOpen}
        title="Delete all notifications"
        description="Are you sure you want to delete all notifications? This only clears notifications for your current account."
        confirmLabel="Delete all notifications"
        isSubmitting={isDeletingAll}
        onClose={() => setIsDeleteAllConfirmOpen(false)}
        onConfirm={() => void handleDeleteAll()}
      />
    </>
  );
};

export const OwnerNotificationsPage = () => (
  <DashboardNotificationsPage
    role="RESTAURANT_OWNER"
    eyebrow="Restaurant owner"
    title="Live alerts for orders, reviews, and offers."
    description="Keep every restaurant update in one inbox so new orders, reminders, and guest feedback stay easy to spot."
    emptyTitle="No owner notifications yet"
    emptyDescription="Order queue updates, review alerts, and offer reminders will appear here."
  />
);

export const DeliveryNotificationsPage = () => (
  <DashboardNotificationsPage
    role="DELIVERY_PARTNER"
    eyebrow="Delivery partner"
    title="Dispatch alerts and live reminders."
    description="Assignment requests, pickup reminders, and delivery-status nudges stay visible in one place."
    emptyTitle="No delivery notifications yet"
    emptyDescription="New requests, pickup reminders, and dispatch updates will appear here."
  />
);

export const OperationsNotificationsPage = () => (
  <OperationsNotificationsContent />
);

const OperationsNotificationsContent = () => {
  return (
    <DashboardNotificationsPage
      role="REGIONAL_MANAGER"
      eyebrow="Operations"
      title="Regional coordination alerts."
      description="Dispatch coverage reminders and operations follow-ups stay organized inside the current dashboard shell."
      emptyTitle="No operations notifications yet"
      emptyDescription="Regional reminders and coordination alerts will appear here."
    />
  );
};

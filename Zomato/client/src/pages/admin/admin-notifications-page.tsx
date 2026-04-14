import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import {
  AdminDataTable,
  AdminLoadingState,
  AdminToolbar,
  ConfirmDangerModal,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNotificationInbox } from "@/hooks/use-notification-inbox";
import { useAuth } from "@/hooks/use-auth";
import {
  createNotification,
  deleteNotification,
  getNotifications,
  getUsers,
  type AdminNotification,
  type AdminUser,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  NOTIFICATION_TYPES,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  formatDateTime,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "./admin-shared";

export const AdminNotificationsPage = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [readFilter, setReadFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdminNotification | null>(null);
  const [isDeleteAllInboxConfirmOpen, setIsDeleteAllInboxConfirmOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({ userId: "", title: "", message: "", type: "SYSTEM", meta: "" });
  const {
    items: inboxNotifications,
    isLoading: isInboxLoading,
    unreadCount,
    hasUnread,
    processingNotificationId,
    isMarkingAllRead,
    isDeletingAll,
    markAsRead,
    markAllRead,
    deleteAll,
  } = useNotificationInbox({
    enabled: user?.role === "ADMIN",
    userId: user?.id,
    onError: (message) => toast.error(message),
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [notificationRows, userRows] = await Promise.all([getNotifications(), getUsers()]);
      setNotifications(notificationRows);
      setUsers(userRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load notifications."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreateModal = () => {
    setForm({ userId: users[0] ? String(users[0].id) : "", title: "", message: "", type: "SYSTEM", meta: "" });
    setIsModalOpen(true);
  };

  const filteredNotifications = notifications.filter((notification) => {
    const haystack = `${notification.title} ${notification.message} ${notification.user.fullName}`;
    return (!search || matchesSearch(haystack, search)) && (typeFilter === "ALL" || notification.type === typeFilter) && (readFilter === "ALL" || (readFilter === "READ" ? notification.isRead : !notification.isRead));
  });

  const pagedNotifications = paginate(filteredNotifications, page);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.userId) {
      toast.error("Choose a recipient first.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createNotification({
        userId: Number(form.userId),
        title: form.title,
        message: form.message,
        type: form.type,
        meta: form.meta.trim() || undefined,
      });
      toast.success("Notification created successfully.");
      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to create this notification."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotification = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteNotification(deleteTarget.id);
      toast.success("Notification deleted successfully.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this notification."));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkAllInboxRead = async () => {
    try {
      await markAllRead();
      toast.success("All notifications marked as read.");
    } catch {
      // Errors are already surfaced by the inbox hook.
    }
  };

  const handleDeleteAllInbox = async () => {
    try {
      await deleteAll();
      if (user?.id) {
        setNotifications((currentNotifications) =>
          currentNotifications.filter((notification) => notification.user.id !== user.id),
        );
      }
      setPage(1);
      setIsDeleteAllInboxConfirmOpen(false);
      toast.success("All notifications deleted.");
    } catch {
      // Errors are already surfaced by the inbox hook.
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Notifications" title="System alerts and manual messaging." description="Review notification history and send targeted messages to platform users." action={<div className="flex gap-3"><RefreshButton onClick={() => void loadData()} /><Button type="button" onClick={openCreateModal}><BellRing className="mr-2 h-4 w-4" />Send notification</Button></div>} />

      <div className="space-y-5">
        <SectionHeading
          title="Your live inbox"
          description={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} for your admin account.`}
          action={
            inboxNotifications.length ? (
              <>
                {hasUnread ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleMarkAllInboxRead()}
                    disabled={isMarkingAllRead || isDeletingAll}
                  >
                    {isMarkingAllRead ? "Saving..." : "Mark all read"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsDeleteAllInboxConfirmOpen(true)}
                  disabled={isDeletingAll || isMarkingAllRead}
                >
                  Delete all
                </Button>
              </>
            ) : undefined
          }
        />
        <NotificationFeed
          items={inboxNotifications}
          role="ADMIN"
          isLoading={isInboxLoading}
          processingNotificationId={processingNotificationId}
          emptyTitle="No admin inbox alerts yet"
          emptyDescription="Personal admin reminders and platform alerts will appear here."
          onMarkAsRead={markAsRead}
        />
      </div>

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, message, or recipient"
        filters={
          <>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-w-[180px]">
              <option value="ALL">All types</option>
              {NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{toLabel(type)}</option>)}
            </Select>
            <Select value={readFilter} onChange={(event) => setReadFilter(event.target.value)} className="min-w-[180px]">
              <option value="ALL">All read states</option>
              <option value="READ">Read</option>
              <option value="UNREAD">Unread</option>
            </Select>
          </>
        }
      />

      {isLoading ? <AdminLoadingState /> : (
        <>
          <AdminDataTable
            rows={pagedNotifications.items}
            getRowKey={(notification) => notification.id}
            emptyTitle="No notifications found"
            emptyDescription="Create a new notification or adjust your filters."
            columns={[
              { key: "title", label: "Message", render: (notification) => <div><p className="font-semibold text-ink">{notification.title}</p><p className="text-sm leading-6 text-ink-soft">{notification.message}</p></div> },
              { key: "recipient", label: "Recipient", render: (notification) => <div><p className="font-semibold text-ink">{notification.user.fullName}</p><p className="text-xs text-ink-muted">{notification.user.email}</p></div> },
              { key: "status", label: "Type and state", render: (notification) => <div className="space-y-2"><StatusPill label={toLabel(notification.type)} tone="info" /><StatusPill label={notification.isRead ? "Read" : "Unread"} tone={getToneForStatus(notification.isRead)} /></div> },
              { key: "created", label: "Created", render: (notification) => formatDateTime(notification.createdAt) },
              { key: "actions", label: "Actions", render: (notification) => <RowActions onDelete={() => setDeleteTarget(notification)} /> },
            ]}
          />
          {filteredNotifications.length > PAGE_SIZE ? <Pagination page={pagedNotifications.currentPage} totalPages={pagedNotifications.totalPages} onPageChange={setPage} /> : null}
        </>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Send notification">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Select label="Recipient" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })}>
            <option value="">Select recipient</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
          </Select>
          <Select label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            {NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{toLabel(type)}</option>)}
          </Select>
          <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Textarea label="Message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required />
          <Input label="Meta JSON (optional)" value={form.meta} onChange={(event) => setForm({ ...form, meta: event.target.value })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending..." : "Send notification"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal open={Boolean(deleteTarget)} title="Delete notification" description="This removes the selected notification from the activity log." confirmLabel="Delete notification" isSubmitting={isDeleting} onClose={() => setDeleteTarget(null)} onConfirm={() => void handleDeleteNotification()} />
      <ConfirmDangerModal
        open={isDeleteAllInboxConfirmOpen}
        title="Delete all notifications"
        description="Are you sure you want to delete all notifications? This only clears notifications for your current admin account."
        confirmLabel="Delete all notifications"
        isSubmitting={isDeletingAll}
        onClose={() => setIsDeleteAllInboxConfirmOpen(false)}
        onConfirm={() => void handleDeleteAllInbox()}
      />
    </div>
  );
};

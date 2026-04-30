import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingState } from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { PageLoadErrorState } from "@/components/ui/page-load-error-state";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/auth";
import {
  getOwnerDashboard,
  getOwnerNotifications,
  type OwnerDashboard,
  type OwnerNotification,
} from "@/lib/owner";
import {
  QuickLinkCard,
  RefreshButton,
  formatCurrency,
  formatDateTime,
  getToneForStatus,
  toLabel,
} from "@/pages/admin/admin-shared";

export const OwnerDashboardPage = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!quietly) {
      setIsLoading(true);
    }

    try {
      const [dashboardData, notificationRows] = await Promise.all([
        getOwnerDashboard(),
        getOwnerNotifications(),
      ]);
      setDashboard(dashboardData);
      setNotifications(notificationRows);
      setErrorMessage(null);
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load the owner dashboard.");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useRealtimeSubscription({
    enabled: user?.role === "RESTAURANT_OWNER",
    userId: user?.id,
    onNotification: (notification) => {
      if (notification.type === "ORDER") {
        void loadDashboard({ quietly: true });
      }
    },
    onOrderStatusUpdate: () => {
      void loadDashboard({ quietly: true });
    },
  });

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Restaurant owner"
          title="Your restaurants and live order momentum."
          description="Loading your restaurant-scoped order activity, reviews, offers, and revenue signals."
          action={<RefreshButton onClick={() => void loadDashboard()} />}
        />
        {isLoading ? (
          <AdminLoadingState rows={6} />
        ) : (
          <PageLoadErrorState
            title="Unable to load the owner dashboard"
            description={errorMessage ?? "Your restaurant dashboard could not be loaded right now."}
            onRetry={() => void loadDashboard()}
          />
        )}
      </div>
    );
  }

  const unreadAlerts = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant owner"
        title="Your restaurants and live order momentum."
        description="Track today's orders, guest sentiment, coupon activity, and dish performance without leaving the premium operations shell."
        action={<RefreshButton onClick={() => void loadDashboard()} />}
      />

      <div className="grid gap-4 xl:grid-cols-7">
        <DashboardStatCard label="Restaurants" value={dashboard.stats.restaurantsCount.toString()} hint="Owned storefronts" />
        <DashboardStatCard label="Today's orders" value={dashboard.stats.todaysOrdersCount.toString()} hint="Orders placed today" />
        <DashboardStatCard label="Pending orders" value={dashboard.stats.pendingOrdersCount.toString()} hint="Need kitchen attention" />
        <DashboardStatCard label="Completed orders" value={dashboard.stats.completedOrdersCount.toString()} hint="Delivered or completed" />
        <DashboardStatCard label="Cancelled orders" value={dashboard.stats.cancelledOrdersCount.toString()} hint="Need follow-up review" />
        <DashboardStatCard label="Revenue" value={formatCurrency(dashboard.stats.revenue)} hint={`${dashboard.stats.reviewsCount} total reviews`} />
        <DashboardStatCard label="Avg. order value" value={formatCurrency(dashboard.stats.averageOrderValue)} hint="Paid order average" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsChart
          data={dashboard.revenueTrend.map((item) => ({ label: item.label, value: item.value }))}
          xKey="label"
          yKey="value"
          title="Revenue trend"
        />
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Quick actions" description="Jump into the parts of your operation that need attention now." />
          <div className="grid gap-4">
            <QuickLinkCard to="/owner/orders" title="Manage live orders" description="Inspect queue health and update restaurant order statuses safely." />
            <QuickLinkCard to="/owner/menu" title="Shape the menu" description="Add dishes, tune pricing, and toggle visibility on the fly." />
            <QuickLinkCard to="/owner/offers" title="Launch offers" description="Create restaurant-only promotions and time-bound coupon campaigns." />
            <QuickLinkCard to="/owner/restaurant" title="Update restaurant profile" description="Refresh contact, imagery, cuisines, and operating details." />
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Recent orders" description="Latest orders across your owned restaurants." />
          <AdminDataTable
            rows={dashboard.recentOrders}
            getRowKey={(order) => order.id}
            emptyTitle="No recent orders"
            emptyDescription="New restaurant orders will appear here."
            columns={[
              {
                key: "order",
                label: "Order",
                render: (order) => (
                  <div>
                    <p className="font-semibold text-ink">{order.orderNumber}</p>
                    <p className="text-xs text-ink-muted">{order.restaurant.name}</p>
                  </div>
                ),
              },
              {
                key: "guest",
                label: "Guest",
                render: (order) => (
                  <div>
                    <p className="font-semibold text-ink">{order.user.fullName}</p>
                    <p className="text-xs text-ink-muted">{order.user.email}</p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (order) => <StatusPill label={toLabel(order.status)} tone={getToneForStatus(order.status)} />,
              },
              {
                key: "total",
                label: "Total",
                render: (order) => <span className="font-semibold text-ink">{formatCurrency(order.totalAmount)}</span>,
              },
              {
                key: "placed",
                label: "Placed",
                render: (order) => formatDateTime(order.orderedAt),
              },
            ]}
          />
        </SurfaceCard>

        <SurfaceCard className="space-y-5">
          <SectionHeading title="Recent alerts" description={`${unreadAlerts} unread notifications across your restaurants.`} />
          {notifications.length ? (
            <div className="space-y-3">
              {notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{notification.title}</p>
                      <p className="text-xs text-ink-muted">{formatDateTime(notification.createdAt)}</p>
                    </div>
                    <StatusPill label={notification.isRead ? "Read" : "New"} tone={notification.isRead ? "neutral" : "info"} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">{notification.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No alerts yet" description="Order, review, and offer alerts will surface here once activity picks up." />
          )}
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Recent reviews" description="Fresh guest feedback for your restaurants." />
          {dashboard.recentReviews.length ? (
            <div className="space-y-3">
              {dashboard.recentReviews.map((review) => (
                <div key={review.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{review.user.fullName}</p>
                      <p className="text-xs text-ink-muted">{review.restaurant.name}</p>
                    </div>
                    <StatusPill label={`${review.rating} / 5`} tone="info" />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">{review.reviewText ?? "No written feedback was provided."}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No reviews yet" description="Guest reviews will appear once completed orders start receiving feedback." />
          )}
        </SurfaceCard>

        <SurfaceCard className="space-y-5">
          <SectionHeading title="Availability alerts" description="Unavailable dishes that may be reducing order coverage right now." />
          {dashboard.availabilityAlerts.length ? (
            <div className="space-y-3">
              {dashboard.availabilityAlerts.map((item) => (
                <div key={item.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-ink-muted">{item.restaurant.name} · {item.category.name}</p>
                    </div>
                    <StatusPill label={item.isRecommended ? "Recommended" : "Unavailable"} tone={item.isRecommended ? "info" : "warning"} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">
                    {formatCurrency(item.price)} · Last updated {formatDateTime(item.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No availability alerts" description="All tracked dishes are currently available for ordering." />
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard className="space-y-5">
        <SectionHeading title="Restaurant snapshot" description="Performance and availability across your storefronts." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.restaurants.map((restaurant) => (
            <div key={restaurant.id} className="rounded-[1.5rem] bg-cream px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl font-semibold text-ink">{restaurant.name}</p>
                  <p className="mt-2 text-sm text-ink-soft">
                    {restaurant.area ?? "Primary area"}, {restaurant.city}
                  </p>
                </div>
                <StatusPill label={restaurant.isActive ? "Active" : "Inactive"} tone={getToneForStatus(restaurant.isActive)} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Rating</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{restaurant.avgRating.toFixed(1)} from {restaurant.totalReviews} reviews</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Hours</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {(restaurant.openingTime ?? "--:--")} to {(restaurant.closingTime ?? "--:--")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-5">
        <SectionHeading title="Popular dishes" description="Menu items driving the most owner-attributed order activity." />
        {dashboard.topDishes.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.topDishes.map((dish) => (
              <div key={dish.id} className="rounded-[1.5rem] bg-cream px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{dish.name}</p>
                    <p className="mt-1 text-xs text-ink-muted">{dish.restaurant.name}</p>
                  </div>
                  <StatusPill label={dish.isAvailable ? "Available" : "Unavailable"} tone={getToneForStatus(dish.isAvailable)} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Orders</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{dish.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Revenue</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(dish.revenue)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No dish trends yet" description="Dish performance will appear once orders start flowing through your restaurants." />
        )}
      </SurfaceCard>
    </div>
  );
};

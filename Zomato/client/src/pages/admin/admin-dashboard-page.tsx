import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingState } from "@/components/admin/admin-ui";
import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { getAdminDashboard, type AdminDashboard } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  QuickLinkCard,
  RefreshButton,
  formatCurrency,
  formatDate,
  formatDateTime,
  getToneForStatus,
  toLabel,
} from "./admin-shared";

export const AdminDashboardPage = () => {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      setDashboard(await getAdminDashboard());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load the admin dashboard."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Admin console"
          title="Platform health in one premium control room."
          description="Loading live admin analytics, recent orders, and new account activity."
          action={<RefreshButton onClick={() => void loadDashboard()} />}
        />
        <AdminLoadingState rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin console"
        title="Platform health in one premium control room."
        description="The admin shell is now connected to live platform data for operations, growth, and moderation."
        action={<RefreshButton onClick={() => void loadDashboard()} />}
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <DashboardStatCard label="Users" value={dashboard.stats.usersCount.toString()} hint="Platform accounts" />
        <DashboardStatCard label="Restaurants" value={dashboard.stats.restaurantsCount.toString()} hint="Partner storefronts" />
        <DashboardStatCard label="Orders" value={dashboard.stats.ordersCount.toString()} hint={`${dashboard.stats.activeOrders} currently active`} />
        <DashboardStatCard label="Delivery partners" value={dashboard.stats.deliveryPartnersCount.toString()} hint="Operations network" />
        <DashboardStatCard label="Revenue" value={formatCurrency(dashboard.stats.grossMerchandiseValue)} hint={`${dashboard.stats.deliveredOrders} delivered orders`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AnalyticsChart
          data={dashboard.ordersByStatus.map((item) => ({ label: toLabel(item.status), value: item.count }))}
          xKey="label"
          yKey="value"
          title="Orders by status"
        />
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Quick actions" description="Jump into the parts of the platform that need attention now." />
          <div className="grid gap-4">
            <QuickLinkCard to="/admin/users" title="Review new accounts" description="Open customer and operator management." />
            <QuickLinkCard to="/admin/orders" title="Watch live orders" description="Track updates, assignments, and delivery progress." />
            <QuickLinkCard to="/admin/live-map" title="Open live map" description="Monitor riders, active deliveries, and ETA signals." />
            <QuickLinkCard to="/admin/restaurants" title="Manage partners" description="Edit partner storefronts and featured listings." />
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Recent orders" description="Fresh activity across the platform." />
          <AdminDataTable
            rows={dashboard.recentOrders}
            getRowKey={(order) => order.id}
            emptyTitle="No recent orders"
            emptyDescription="New platform activity will appear here."
            columns={[
              { key: "order", label: "Order", render: (order) => <div><p className="font-semibold text-ink">{order.orderNumber}</p><p className="text-xs text-ink-muted">{order.restaurant.name}</p></div> },
              { key: "customer", label: "Customer", render: (order) => <div><p className="font-semibold text-ink">{order.user.fullName}</p><p className="text-xs text-ink-muted">{order.user.email}</p></div> },
              { key: "status", label: "Status", render: (order) => <StatusPill label={toLabel(order.status)} tone={getToneForStatus(order.status)} /> },
              { key: "value", label: "Total", render: (order) => <span className="font-semibold text-ink">{formatCurrency(order.totalAmount)}</span> },
              { key: "placed", label: "Placed", render: (order) => formatDateTime(order.orderedAt) },
            ]}
          />
        </SurfaceCard>

        <SurfaceCard className="space-y-5">
          <SectionHeading title="Recent signups" description="Newest accounts on the platform." />
          <div className="space-y-3">
            {dashboard.recentUsers.map((user) => (
              <div key={user.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{user.fullName}</p>
                    <p className="text-xs text-ink-muted">{user.email}</p>
                  </div>
                  <StatusPill label={toLabel(user.role)} tone={getToneForStatus(user.isActive)} />
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-ink-muted">{formatDate(user.createdAt)}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="space-y-5">
        <SectionHeading title="Top restaurants" description="Highest-signal partners by review momentum." />
        <div className="grid gap-4 md:grid-cols-3">
          {dashboard.topRestaurants.map((restaurant) => (
            <div key={restaurant.id} className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="font-display text-3xl font-semibold text-ink">{restaurant.name}</p>
              <p className="mt-2 text-sm text-ink-soft">
                {restaurant.totalReviews} reviews • {restaurant.avgRating.toFixed(1)} rating
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-ink-muted">
                Cost for two {formatCurrency(restaurant.costForTwo)}
              </p>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
};

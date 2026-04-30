import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { PageLoadErrorState } from "@/components/ui/page-load-error-state";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { getApiErrorMessage } from "@/lib/auth";
import { getOwnerDashboard, type OwnerDashboard } from "@/lib/owner";
import {
  RefreshButton,
  formatCurrency,
  getToneForStatus,
  toLabel,
} from "@/pages/admin/admin-shared";

export const OwnerAnalyticsPage = () => {
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      setDashboard(await getOwnerDashboard());
      setErrorMessage(null);
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load your analytics.");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (isLoading || !dashboard) {
    return isLoading ? (
      <AdminLoadingState rows={6} />
    ) : (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Owner analytics"
          title="Restaurant-only analytics and operational insights."
          description="Use owner-scoped revenue, order, review, cancellation, and preparation signals to understand how your restaurants are performing."
          action={<RefreshButton onClick={() => void loadDashboard()} />}
        />
        <PageLoadErrorState
          title="Unable to load owner analytics"
          description={errorMessage ?? "Your owner analytics could not be loaded right now."}
          onRetry={() => void loadDashboard()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Owner analytics"
        title="Restaurant-only analytics and operational insights."
        description="Use owner-scoped revenue, order, review, cancellation, and preparation signals to understand how your restaurants are performing."
        action={<RefreshButton onClick={() => void loadDashboard()} />}
      />

      <div className="grid gap-4 xl:grid-cols-6">
        <DashboardStatCard label="Owned restaurants" value={dashboard.stats.restaurantsCount.toString()} hint="Restaurants under this account" />
        <DashboardStatCard label="Today's orders" value={dashboard.stats.todaysOrdersCount.toString()} hint="Current day activity" />
        <DashboardStatCard label="Completed" value={dashboard.stats.completedOrdersCount.toString()} hint="Delivered and closed orders" />
        <DashboardStatCard label="Cancelled" value={dashboard.stats.cancelledOrdersCount.toString()} hint="Orders cancelled so far" />
        <DashboardStatCard label="Revenue" value={formatCurrency(dashboard.stats.revenue)} hint="Paid order revenue" />
        <DashboardStatCard label="Avg. order value" value={formatCurrency(dashboard.stats.averageOrderValue)} hint="Average paid order size" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AnalyticsChart
          data={dashboard.revenueTrend.map((item) => ({ label: item.label, value: item.value }))}
          xKey="label"
          yKey="value"
          title="Seven-day revenue trend"
        />
        <AnalyticsChart
          data={dashboard.busyHours.map((item) => ({ label: item.label, value: item.count }))}
          xKey="label"
          yKey="value"
          title="Busy hours"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Order status mix" description="Where your current restaurant queue is concentrated right now." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.ordersByStatus.map((item) => (
              <div key={item.status} className="rounded-[1.5rem] bg-cream px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">{toLabel(item.status)}</p>
                  <StatusPill label={String(item.count)} tone={getToneForStatus(item.status)} />
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-5">
          <SectionHeading title="Cancellation summary" description="Monitor churn and protect guest confidence." />
          <div className="space-y-3">
            <div className="rounded-[1.5rem] bg-cream px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cancelled orders</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{dashboard.cancellationSummary.cancelledOrdersCount}</p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cancellation rate</p>
              <p className="mt-2 text-3xl font-semibold text-ink">
                {(dashboard.cancellationSummary.cancellationRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Preparation time summary" description="Compare your kitchen prep baselines across restaurants." />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] bg-cream px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Average prep</p>
              <p className="mt-2 text-3xl font-semibold text-ink">
                {dashboard.prepTimeSummary.averagePreparationTime.toFixed(0)} min
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Fastest kitchen</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {dashboard.prepTimeSummary.fastestRestaurant?.name ?? "Unavailable"}
              </p>
              <p className="text-xs text-ink-muted">
                {dashboard.prepTimeSummary.fastestRestaurant
                  ? `${dashboard.prepTimeSummary.fastestRestaurant.preparationTime} min`
                  : "No prep data"}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Slowest kitchen</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {dashboard.prepTimeSummary.slowestRestaurant?.name ?? "Unavailable"}
              </p>
              <p className="text-xs text-ink-muted">
                {dashboard.prepTimeSummary.slowestRestaurant
                  ? `${dashboard.prepTimeSummary.slowestRestaurant.preparationTime} min`
                  : "No prep data"}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-5">
          <SectionHeading title="Restaurant performance" description="Availability and service quality across your restaurants." />
          <div className="space-y-3">
            {dashboard.restaurants.map((restaurant) => (
              <div key={restaurant.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{restaurant.name}</p>
                    <p className="text-xs text-ink-muted">{restaurant.area ?? "Primary area"}, {restaurant.city}</p>
                  </div>
                  <StatusPill label={restaurant.isActive ? "Active" : "Inactive"} tone={getToneForStatus(restaurant.isActive)} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Rating</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{restaurant.avgRating.toFixed(1)} / 5</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Average ETA</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{restaurant.avgDeliveryTime} mins</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="space-y-5">
        <SectionHeading title="Top dishes" description="Owner-attributed dish performance based on completed and active order lines." />
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
          <EmptyState title="No dish analytics yet" description="Once orders arrive, popular dishes will appear here automatically." />
        )}
      </SurfaceCard>

      <SurfaceCard className="space-y-5">
        <SectionHeading title="Availability alerts" description="Unavailable dishes that may be suppressing order coverage." />
        {dashboard.availabilityAlerts.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.availabilityAlerts.map((item) => (
              <div key={item.id} className="rounded-[1.5rem] bg-cream px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="mt-1 text-xs text-ink-muted">{item.restaurant.name}</p>
                  </div>
                  <StatusPill label={item.isRecommended ? "Recommended" : "Unavailable"} tone={item.isRecommended ? "info" : "warning"} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Category</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{item.category.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Price</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(item.price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No availability gaps" description="All tracked dishes are currently available across your menu." />
        )}
      </SurfaceCard>
    </div>
  );
};

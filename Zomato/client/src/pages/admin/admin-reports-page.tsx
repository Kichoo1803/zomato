import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingState } from "@/components/admin/admin-ui";
import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { Button } from "@/components/ui/button";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import {
  getAdminDashboard,
  getRegionsAdmin,
  type AdminDashboard,
  type AdminRegion,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  RefreshButton,
  formatCurrency,
  toLabel,
} from "./admin-shared";

const buildRegionLabel = (region: AdminRegion) => `${region.districtName}, ${region.stateName}`;

export const AdminReportsPage = () => {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadReports = async () => {
    setIsLoading(true);

    try {
      const [dashboardData, regionRows] = await Promise.all([
        getAdminDashboard({
          regionId: regionFilter ? Number(regionFilter) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        getRegionsAdmin({ isActive: true }),
      ]);
      setDashboard(dashboardData);
      setRegions(regionRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load admin analytics."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, [regionFilter, startDate, endDate]);

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === Number(regionFilter)) ?? null,
    [regionFilter, regions],
  );

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Analytics"
        title="Platform analytics across approvals, orders, and regional coverage."
        description="Track users, restaurants, owner onboarding, rider onboarding, orders, revenue, and region-level momentum from one admin view."
        action={<RefreshButton onClick={() => void loadReports()} />}
      />

      <SurfaceCard className="grid gap-4 xl:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,220px)_auto]">
        <Select
          label="Region"
          value={regionFilter}
          onChange={(event) => setRegionFilter(event.target.value)}
        >
          <option value="">Overall platform</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {buildRegionLabel(region)}
            </option>
          ))}
        </Select>
        <Input
          label="Start date"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <Input
          label="End date"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setRegionFilter("");
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </SurfaceCard>

      {selectedRegion ? (
        <SurfaceCard className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Focused region</p>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-3xl font-semibold text-ink">{buildRegionLabel(selectedRegion)}</h3>
            <StatusPill label={selectedRegion.manager ? "Manager assigned" : "Admin fallback"} tone={selectedRegion.manager ? "success" : "warning"} />
          </div>
          <p className="text-sm leading-7 text-ink-soft">
            The analytics below are currently filtered to this region only, including applications, order flow,
            users, and restaurants.
          </p>
        </SurfaceCard>
      ) : null}

      {isLoading || !dashboard ? (
        <AdminLoadingState rows={8} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-6">
            <DashboardStatCard label="Users" value={dashboard.stats.usersCount.toString()} hint="All roles in scope" />
            <DashboardStatCard label="Restaurants" value={dashboard.stats.restaurantsCount.toString()} hint="Storefronts in scope" />
            <DashboardStatCard label="Owners" value={dashboard.stats.restaurantOwnersCount.toString()} hint="Approved owner accounts" />
            <DashboardStatCard label="Delivery partners" value={dashboard.stats.deliveryPartnersCount.toString()} hint="Approved rider accounts" />
            <DashboardStatCard label="Pending approvals" value={dashboard.stats.pendingApplicationsCount.toString()} hint="Applications awaiting review" />
            <DashboardStatCard label="Revenue" value={formatCurrency(dashboard.stats.grossMerchandiseValue)} hint={`${dashboard.stats.ordersCount} orders`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <DashboardStatCard label="Approved applications" value={dashboard.stats.approvedApplicationsCount.toString()} hint="Onboarding approvals" />
            <DashboardStatCard label="Rejected applications" value={dashboard.stats.rejectedApplicationsCount.toString()} hint="Recorded with remarks" />
            <DashboardStatCard label="Delivered orders" value={dashboard.stats.deliveredOrders.toString()} hint={`${dashboard.stats.activeOrders} active right now`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AnalyticsChart
              data={dashboard.ordersByStatus.map((item) => ({ label: toLabel(item.status), value: item.count }))}
              xKey="label"
              yKey="value"
              title="Orders by status"
            />
            <AnalyticsChart
              data={dashboard.applicationsByStatus.map((item) => ({ label: toLabel(item.status), value: item.count }))}
              xKey="label"
              yKey="value"
              title="Applications by status"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AnalyticsChart
              data={dashboard.usersByRole.map((item) => ({ label: toLabel(item.role), value: item.count }))}
              xKey="label"
              yKey="value"
              title="Users by role"
            />
            <AnalyticsChart
              data={dashboard.applicationsByRole.map((item) => ({ label: toLabel(item.roleType), value: item.count }))}
              xKey="label"
              yKey="value"
              title="Applications by role"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AnalyticsChart data={dashboard.dailyOrderTrends} xKey="label" yKey="value" title="Daily order trend" />
            <AnalyticsChart data={dashboard.weeklyOrderTrends} xKey="label" yKey="value" title="Weekly order trend" />
            <AnalyticsChart data={dashboard.monthlyOrderTrends} xKey="label" yKey="value" title="Monthly order trend" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <SurfaceCard className="space-y-5">
              <SectionHeading
                title="Region coverage table"
                description="Region-wise restaurants, delivery partners, users, and orders inside the current filter window."
              />
              <AdminDataTable
                rows={dashboard.regionMetrics}
                getRowKey={(metric) => metric.regionId}
                emptyTitle="No regional analytics"
                emptyDescription="Region metrics will appear once restaurants, users, or orders are mapped into regions."
                columns={[
                  {
                    key: "region",
                    label: "Region",
                    render: (metric) => (
                      <div>
                        <p className="font-semibold text-ink">{metric.districtName}</p>
                        <p className="text-xs text-ink-muted">{metric.stateName}</p>
                      </div>
                    ),
                  },
                  {
                    key: "restaurants",
                    label: "Restaurants",
                    render: (metric) => <span className="font-semibold text-ink">{metric.restaurantsCount}</span>,
                  },
                  {
                    key: "partners",
                    label: "Delivery partners",
                    render: (metric) => <span className="font-semibold text-ink">{metric.deliveryPartnersCount}</span>,
                  },
                  {
                    key: "users",
                    label: "Users",
                    render: (metric) => <span className="font-semibold text-ink">{metric.usersCount}</span>,
                  },
                  {
                    key: "orders",
                    label: "Orders",
                    render: (metric) => <span className="font-semibold text-ink">{metric.ordersCount}</span>,
                  },
                ]}
              />
            </SurfaceCard>

            <SurfaceCard className="space-y-5">
              <SectionHeading
                title="Top restaurant report"
                description="Highest-signal restaurant performers by review and rating."
              />
              {dashboard.topRestaurants.length ? (
                <div className="space-y-3">
                  {dashboard.topRestaurants.map((restaurant) => (
                    <div key={restaurant.id} className="rounded-[1.5rem] bg-cream px-5 py-4">
                      <p className="font-display text-3xl font-semibold text-ink">{restaurant.name}</p>
                      <p className="mt-2 text-sm text-ink-soft">
                        {restaurant.avgRating.toFixed(1)} rating â€¢ {restaurant.totalReviews} reviews
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-ink-muted">
                        Cost for two {formatCurrency(restaurant.costForTwo)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No restaurants in this scope"
                  description="Expand the region or date filters to bring restaurant metrics into view."
                />
              )}
            </SurfaceCard>
          </div>
        </>
      )}
    </div>
  );
};

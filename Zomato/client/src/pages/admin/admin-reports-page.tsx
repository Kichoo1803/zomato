import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { SectionHeading, SurfaceCard } from "@/components/ui/page-shell";
import { getAdminDashboard, type AdminDashboard } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import { RefreshButton, formatCurrency, toLabel } from "./admin-shared";

export const AdminReportsPage = () => {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      setDashboard(await getAdminDashboard());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load admin reports."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Reports and analytics"
        title="Platform reporting without leaving admin."
        description="Order mix, role distribution, and restaurant momentum all stay inside the same premium shell."
        action={<RefreshButton onClick={() => void loadReports()} />}
      />

      {isLoading || !dashboard ? (
        <AdminLoadingState rows={6} />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <AnalyticsChart data={dashboard.ordersByStatus.map((item) => ({ label: toLabel(item.status), value: item.count }))} xKey="label" yKey="value" title="Order status report" />
            <AnalyticsChart data={dashboard.usersByRole.map((item) => ({ label: toLabel(item.role), value: item.count }))} xKey="label" yKey="value" title="User role distribution" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <DashboardStatCard label="Delivered orders" value={dashboard.stats.deliveredOrders.toString()} hint="Successful fulfilment" />
            <DashboardStatCard label="Active orders" value={dashboard.stats.activeOrders.toString()} hint="Currently in progress" />
            <DashboardStatCard label="GMV" value={formatCurrency(dashboard.stats.grossMerchandiseValue)} hint="Paid payment total" />
          </div>

          <SurfaceCard className="space-y-5">
            <SectionHeading title="Top restaurant report" description="Strongest restaurant performers by review and rating signal." />
            <div className="grid gap-4 md:grid-cols-3">
              {dashboard.topRestaurants.map((restaurant) => (
                <div key={restaurant.id} className="rounded-[1.5rem] bg-cream px-5 py-4">
                  <p className="font-display text-3xl font-semibold text-ink">{restaurant.name}</p>
                  <p className="mt-2 text-sm text-ink-soft">{restaurant.avgRating.toFixed(1)} rating • {restaurant.totalReviews} reviews</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </>
      )}
    </div>
  );
};

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingState } from "@/components/admin/admin-ui";
import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { Button } from "@/components/ui/button";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, mergeRegionOptions } from "@/lib/india-regions";
import { getOperationsDashboard, type OperationsDashboard } from "@/lib/ops";
import {
  QuickLinkCard,
  RefreshButton,
  formatDateTime,
  getToneForStatus,
} from "@/pages/admin/admin-shared";

export const OpsDashboardPage = () => {
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      setDashboard(
        await getOperationsDashboard({
          state: stateFilter || undefined,
          district: districtFilter || undefined,
        }),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load the operations dashboard."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [stateFilter, districtFilter]);

  const regionOptions = useMemo(() => mergeRegionOptions(dashboard?.regionOptions), [dashboard?.regionOptions]);
  const districtOptions = useMemo(
    () => getDistrictOptions(stateFilter, dashboard?.regionOptions),
    [dashboard?.regionOptions, stateFilter],
  );

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="India operations"
          title="State and district control in one coordinated ops view."
          description="Loading regional assignments, owner coverage, partner coverage, and recent coordination updates."
          action={<RefreshButton onClick={() => void loadDashboard()} />}
        />
        <AdminLoadingState rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="India operations"
        title="State and district control in one coordinated ops view."
        description="Track owner coverage, delivery readiness, and assignment health across the combined India region hierarchy."
        action={<RefreshButton onClick={() => void loadDashboard()} />}
      />

      <SurfaceCard className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <Select
          label="State"
          value={stateFilter}
          onChange={(event) => {
            setStateFilter(event.target.value);
            setDistrictFilter("");
          }}
        >
          <option value="">All states</option>
          {regionOptions.states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </Select>
        <Select
          label="District"
          value={districtFilter}
          onChange={(event) => setDistrictFilter(event.target.value)}
          disabled={!stateFilter}
        >
          <option value="">{stateFilter ? "All districts" : "Choose a state first"}</option>
          {districtOptions.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </Select>
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => { setStateFilter(""); setDistrictFilter(""); }}>
            Clear filters
          </Button>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-7">
        <DashboardStatCard label="States" value={dashboard.stats.statesCount.toString()} hint="With mapped operations coverage" />
        <DashboardStatCard label="Districts" value={dashboard.stats.districtsCount.toString()} hint="Active regional drill-down" />
        <DashboardStatCard label="Owners" value={dashboard.stats.ownersCount.toString()} hint="Scoped operator accounts" />
        <DashboardStatCard label="Delivery partners" value={dashboard.stats.deliveryPartnersCount.toString()} hint="Regional rider network" />
        <DashboardStatCard label="Restaurants" value={dashboard.stats.restaurantsCount.toString()} hint="Linked to managed owners" />
        <DashboardStatCard label="Fully assigned" value={dashboard.stats.fullyAssignedCount.toString()} hint="State + district completed" />
        <DashboardStatCard label="Needs assignment" value={dashboard.stats.unassignedCount.toString()} hint="Missing state or district mapping" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsChart
          data={dashboard.stateSummaries.map((summary) => ({
            label: summary.state,
            value: summary.ownersCount + summary.deliveryPartnersCount,
          }))}
          xKey="label"
          yKey="value"
          title="Regional coverage by state"
        />
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Quick actions" description="Move straight into regional coordination tasks that need attention." />
          <div className="grid gap-4">
            <QuickLinkCard to="/ops/regions" title="Open region control" description="Drill from state to district and inspect readiness in one workflow." />
            <QuickLinkCard to="/ops/applications" title="Review applications" description="Approve or reject owner and rider onboarding requests in your assigned districts." />
            <QuickLinkCard to="/ops/restaurant-owners" title="Review owner coverage" description="Check linked restaurants, assignment status, and operational notes." />
            <QuickLinkCard to="/ops/delivery-partners" title="Review rider coverage" description="Filter partners by state, district, availability, and assignment readiness." />
            <QuickLinkCard to="/ops/assignments" title="Fix unassigned queues" description="Map missing owners and riders into the right India region hierarchy." />
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title="State summaries" description="Quick filter cards for the highest-signal operating regions." />
          {dashboard.stateSummaries.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.stateSummaries.map((summary) => (
                <button
                  key={summary.state}
                  type="button"
                  onClick={() => {
                    setStateFilter(summary.state);
                    setDistrictFilter("");
                  }}
                  className="rounded-[1.5rem] bg-cream px-5 py-4 text-left shadow-soft transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-3xl font-semibold text-ink">{summary.state}</p>
                      <p className="mt-2 text-sm text-ink-soft">
                        {summary.districtsCount} districts mapped
                      </p>
                    </div>
                    <StatusPill
                      label={summary.unassignedCount ? "Needs follow-up" : "Ready"}
                      tone={summary.unassignedCount ? "warning" : "success"}
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Owners</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{summary.ownersCount}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Partners</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{summary.deliveryPartnersCount}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No regional assignments yet" description="Assign owners and delivery partners to states and districts to build the India operations map." />
          )}
        </SurfaceCard>

        <SurfaceCard className="space-y-5">
          <SectionHeading title="Recent updates" description="Latest region notes and assignment activity." />
          {dashboard.recentUpdates.length ? (
            <div className="space-y-3">
              {dashboard.recentUpdates.map((update) => (
                <div key={update.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{update.title}</p>
                      <p className="text-xs text-ink-muted">{formatDateTime(update.updatedAt)}</p>
                    </div>
                    <StatusPill label={update.kind.replace(/_/g, " ")} tone={getToneForStatus(update.kind)} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">{update.description}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-ink-muted">
                    {[update.state, update.district].filter(Boolean).join(" • ") || "India operations"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No operations updates yet" description="Region notes and assignment updates will start appearing here once the ops flow is active." />
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard className="space-y-5">
        <SectionHeading title="District summaries" description="State-first drill-down for owner, rider, and restaurant coverage." />
        <AdminDataTable
          rows={dashboard.districtSummaries}
          getRowKey={(summary) => `${summary.state}-${summary.district}`}
          emptyTitle="No district summaries"
          emptyDescription="Assign owners or partners to a district to populate the regional drill-down."
          columns={[
            {
              key: "region",
              label: "Region",
              render: (summary) => (
                <div>
                  <p className="font-semibold text-ink">{summary.district}</p>
                  <p className="text-xs text-ink-muted">{summary.state}</p>
                </div>
              ),
            },
            { key: "owners", label: "Owners", render: (summary) => <span className="font-semibold text-ink">{summary.ownersCount}</span> },
            { key: "partners", label: "Partners", render: (summary) => <span className="font-semibold text-ink">{summary.deliveryPartnersCount}</span> },
            { key: "restaurants", label: "Restaurants", render: (summary) => <span className="font-semibold text-ink">{summary.restaurantsCount}</span> },
            {
              key: "status",
              label: "Status",
              render: (summary) => (
                <StatusPill
                  label={summary.unassignedCount ? "Attention needed" : "Ready"}
                  tone={summary.unassignedCount ? "warning" : "success"}
                />
              ),
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
};

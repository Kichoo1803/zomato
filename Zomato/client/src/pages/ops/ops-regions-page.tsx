import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingState } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, mergeRegionOptions } from "@/lib/india-regions";
import { getOperationsRegions, type OperationsSummaryStats } from "@/lib/ops";
import { RefreshButton } from "@/pages/admin/admin-shared";

type RegionsData = {
  filters: {
    state?: string | null;
    district?: string | null;
  };
  regionOptions: {
    states: string[];
    districtsByState: Record<string, string[]>;
  };
  stats: OperationsSummaryStats;
  stateSummaries: Array<{
    state: string;
    ownersCount: number;
    deliveryPartnersCount: number;
    restaurantsCount: number;
    districtsCount: number;
    fullyAssignedCount: number;
    unassignedCount: number;
  }>;
  districtSummaries: Array<{
    state: string;
    district: string;
    ownersCount: number;
    deliveryPartnersCount: number;
    restaurantsCount: number;
    fullyAssignedCount: number;
    unassignedCount: number;
  }>;
};

export const OpsRegionsPage = () => {
  const [regions, setRegions] = useState<RegionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [expandedState, setExpandedState] = useState<string | null>(null);

  const loadRegions = async () => {
    setIsLoading(true);
    try {
      setRegions(
        await getOperationsRegions({
          state: stateFilter || undefined,
          district: districtFilter || undefined,
        }),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load the regions view."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRegions();
  }, [stateFilter, districtFilter]);

  const regionOptions = useMemo(() => mergeRegionOptions(regions?.regionOptions), [regions?.regionOptions]);
  const districtOptions = useMemo(
    () => getDistrictOptions(stateFilter, regions?.regionOptions),
    [regions?.regionOptions, stateFilter],
  );
  const totalDistrictCount = useMemo(
    () => Object.values(regionOptions.districtsByState).reduce((count, districts) => count + districts.length, 0),
    [regionOptions.districtsByState],
  );
  const stateSummaryMap = useMemo(
    () => new Map((regions?.stateSummaries ?? []).map((summary) => [summary.state, summary])),
    [regions?.stateSummaries],
  );
  const districtSummaryMap = useMemo(
    () =>
      new Map(
        (regions?.districtSummaries ?? []).map((summary) => [
          `${summary.state}::${summary.district}`,
          summary,
        ]),
      ),
    [regions?.districtSummaries],
  );
  const visibleDistrictSummaries = useMemo(() => {
    if (!regions) {
      return [];
    }

    if (!stateFilter) {
      return regions.districtSummaries;
    }

    return (regionOptions.districtsByState[stateFilter] ?? [])
      .map((district) =>
        districtSummaryMap.get(`${stateFilter}::${district}`) ?? {
          state: stateFilter,
          district,
          ownersCount: 0,
          deliveryPartnersCount: 0,
          restaurantsCount: 0,
          fullyAssignedCount: 0,
          unassignedCount: 0,
        },
      )
      .filter((summary) => !districtFilter || summary.district === districtFilter);
  }, [districtFilter, districtSummaryMap, regionOptions.districtsByState, regions, stateFilter]);

  useEffect(() => {
    if (stateFilter) {
      setExpandedState(stateFilter);
    }
  }, [stateFilter]);

  if (isLoading || !regions) {
    return <AdminLoadingState rows={6} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Regional control"
        title="One India-focused workflow for state and district operations."
        description="Browse states first, drill into districts second, and keep owner and rider management inside one clean regional system."
        action={<RefreshButton onClick={() => void loadRegions()} />}
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
            Reset view
          </Button>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-5">
        <DashboardStatCard label="States" value={regionOptions.states.length.toString()} hint="Top-level India controls" />
        <DashboardStatCard label="Districts" value={totalDistrictCount.toString()} hint="Full district visibility by state" />
        <DashboardStatCard label="Owners" value={regions.stats.ownersCount.toString()} hint="Mapped restaurant owners" />
        <DashboardStatCard label="Partners" value={regions.stats.deliveryPartnersCount.toString()} hint="Mapped delivery partners" />
        <DashboardStatCard label="Needs follow-up" value={regions.stats.unassignedCount.toString()} hint="Missing complete region mapping" />
      </div>

      <SurfaceCard className="space-y-5">
        <SectionHeading
          title="State cards"
          description="Focus any state to reveal every district mapped under it, then filter down without leaving the current operations layout."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {regionOptions.states.map((state) => {
            const summary = stateSummaryMap.get(state);
            const districts = regionOptions.districtsByState[state] ?? [];
            const isExpanded = expandedState === state || stateFilter === state;

            return (
              <div
                key={state}
                className={`rounded-[1.5rem] bg-cream px-5 py-4 shadow-soft transition ${
                  stateFilter === state ? "ring-1 ring-accent/20" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedState(state);
                    setStateFilter(state);
                    setDistrictFilter("");
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-3xl font-semibold text-ink">{state}</p>
                      <p className="mt-2 text-sm text-ink-soft">
                        {districts.length} districts listed • {summary?.restaurantsCount ?? 0} linked restaurants
                      </p>
                    </div>
                    <StatusPill
                      label={(summary?.unassignedCount ?? 0) ? "Attention needed" : "Stable"}
                      tone={(summary?.unassignedCount ?? 0) ? "warning" : "success"}
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Owners</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{summary?.ownersCount ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Partners</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{summary?.deliveryPartnersCount ?? 0}</p>
                    </div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="mt-5 border-t border-accent/10 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Districts</p>
                      {districtFilter ? (
                        <button
                          type="button"
                          onClick={() => setDistrictFilter("")}
                          className="text-xs font-semibold text-accent"
                        >
                          Clear district
                        </button>
                      ) : null}
                    </div>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {districts.map((district) => {
                          const districtSummary = districtSummaryMap.get(`${state}::${district}`);
                          const isSelected = stateFilter === state && districtFilter === district;

                          return (
                            <button
                              key={district}
                              type="button"
                              onClick={() => {
                                setExpandedState(state);
                                setStateFilter(state);
                                setDistrictFilter(district);
                              }}
                              className={`rounded-full px-3 py-2 text-left text-xs font-semibold transition ${
                                isSelected
                                  ? "bg-white text-ink shadow-soft"
                                  : "bg-white/70 text-ink-soft hover:bg-white"
                              }`}
                            >
                              <span className="block text-ink">{district}</span>
                              <span className="mt-1 block text-[11px] text-ink-muted">
                                {districtSummary?.restaurantsCount ?? 0} restaurants
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-5">
        <SectionHeading
          title="District drill-down"
          description={
            stateFilter
              ? "Every district under the selected state stays visible here, including districts that do not have assignments yet."
              : "Select a state above to review every district under it, or use the global filters to narrow the view."
          }
        />
        <AdminDataTable
          rows={visibleDistrictSummaries}
          getRowKey={(summary) => `${summary.state}-${summary.district}`}
          emptyTitle="No district assignments found"
          emptyDescription="District rows appear here as soon as a state is focused or operations assignments include district mappings."
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
              key: "readiness",
              label: "Readiness",
              render: (summary) => (
                <StatusPill
                  label={summary.unassignedCount ? "Needs follow-up" : "Ready"}
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

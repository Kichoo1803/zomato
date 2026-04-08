import { useState } from "react";
import { Bike, ShieldCheck } from "lucide-react";
import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { Button } from "@/components/ui/button";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { Input } from "@/components/ui/input";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Table } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { dashboardSeries, deliveryActiveRows, deliveryHistoryRows, deliveryStats } from "@/lib/demo-data";

const deliveryEarningsRows = [
  ["08 Apr", "Lunch rush bonus", "Rs. 420", "Paid"],
  ["07 Apr", "Peak-hour incentive", "Rs. 250", "Paid"],
  ["06 Apr", "Referral top-up", "Rs. 600", "Processing"],
];

// Delivery surfaces currently reuse shared demo metrics so the routes stay complete without disturbing backend modules.
export const DeliveryDashboardPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Delivery partner"
        title="Shift view, live and ready."
        description="The delivery dashboard now has real route destinations for active runs, earnings, and profile readiness."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {deliveryStats.map((stat) => (
          <DashboardStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsChart data={dashboardSeries} xKey="label" yKey="value" title="Completed deliveries" />
        <SurfaceCard className="space-y-4">
          <SectionHeading title="Shift readiness" description="Everything needed before accepting the next request." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Current zone</p>
              <p className="mt-2 text-sm text-ink-soft">Whitefield and Indiranagar</p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Vehicle</p>
              <p className="mt-2 text-sm text-ink-soft">Bike KA 03 MH 8821</p>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <Table columns={["Order", "Restaurant", "Zone", "Status"]} rows={deliveryActiveRows} />
    </div>
  );
};

export const DeliveryActivePage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Active deliveries"
        title="Current runs and pickup queue."
        description="Active deliveries now live on their own route instead of sharing the generic dashboard placeholder."
      />

      <Table columns={["Order", "Restaurant", "Zone", "Status"]} rows={deliveryActiveRows} />
    </div>
  );
};

export const DeliveryHistoryPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="History"
        title="Completed delivery archive."
        description="Past jobs, customer ratings, and payout values remain easy to scan in the current dashboard design system."
      />

      <Table columns={["Order", "Restaurant", "Earnings", "Rating", "Outcome"]} rows={deliveryHistoryRows} />
    </div>
  );
};

export const DeliveryEarningsPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Earnings"
        title="Daily earnings and incentive visibility."
        description="A dedicated earnings page rounds out the rider dashboard using the existing stat cards and charts."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Shift total", value: "Rs. 2,480", hint: "Including incentives" },
          { label: "Average per order", value: "Rs. 138", hint: "Last 18 deliveries" },
          { label: "Next payout", value: "Rs. 6,920", hint: "Expected tomorrow" },
        ].map((stat) => (
          <DashboardStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <AnalyticsChart data={dashboardSeries} xKey="label" yKey="value" title="Weekly earning momentum" />
      <Table columns={["Date", "Source", "Amount", "Status"]} rows={deliveryEarningsRows} />
    </div>
  );
};

export const DeliveryProfilePage = () => {
  const { user } = useAuth();
  const [isAvailable, setIsAvailable] = useState(true);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Availability and profile"
        title="Shift controls, documents, and contact details."
        description="This route combines availability and rider profile data so the delivery side has a complete operational surface."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <Input label="Full name" defaultValue={user?.fullName ?? "Ravi Kumar"} />
          <Input label="Email" defaultValue={user?.email ?? "ravi.kumar@zomatoluxe.dev"} />
          <Input label="Phone" defaultValue={user?.phone ?? "+91 98200 00201"} />
          <Input label="Vehicle number" defaultValue="KA03EX1045" />
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Availability</p>
            <h2 className="mt-2 font-display text-4xl font-semibold text-ink">
              {isAvailable ? "Online for orders" : "Taking a short pause"}
            </h2>
          </div>
          <Button type="button" variant={isAvailable ? "secondary" : "primary"} onClick={() => setIsAvailable((value) => !value)}>
            {isAvailable ? "Go offline" : "Go online"}
          </Button>
          <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">Driving license</span>
              <StatusPill label="Approved" tone="success" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">Vehicle RC</span>
              <StatusPill label="Approved" tone="success" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">Safety review</span>
              <StatusPill label="Up to date" tone="info" />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <p className="text-sm leading-7 text-ink-soft">Document refresh and availability sync are ready to connect to the delivery partner endpoints when needed.</p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

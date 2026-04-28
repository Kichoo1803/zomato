import { Link } from "react-router-dom";
import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { Button } from "@/components/ui/button";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Input } from "@/components/ui/input";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Table } from "@/components/ui/table";
import { ReviewCard } from "@/components/cards/review-card";
import { dashboardSeries, partnerMenuRows, partnerOrdersRows, partnerStats, restaurants } from "@/lib/demo-data";

const partnerRestaurant = restaurants[0];
const partnerPayoutRows = [
  ["08 Apr", "Weekly settlement", "Completed", "Rs. 24,500"],
  ["05 Apr", "Adjustment credit", "Completed", "Rs. 3,200"],
  ["03 Apr", "Wallet release", "In progress", "Rs. 8,450"],
];

// Shared demo datasets keep these routes production-safe until page-level dashboard APIs are attached.
export const PartnerDashboardPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant partner"
        title="Kitchen performance at a glance."
        description="The partner dashboard now has real route destinations with polished stats, analytics, and order snapshots."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {partnerStats.map((stat) => (
          <DashboardStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsChart data={dashboardSeries} xKey="label" yKey="value" title="Orders this week" />
        <SurfaceCard className="space-y-4">
          <SectionHeading title={partnerRestaurant.name} description={partnerRestaurant.heroNote} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Average rating</p>
              <p className="mt-2 font-display text-4xl font-semibold text-ink">{partnerRestaurant.rating.toFixed(1)}</p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Average ETA</p>
              <p className="mt-2 font-display text-4xl font-semibold text-ink">{partnerRestaurant.deliveryTime} min</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/partner/orders" className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft">
              Open orders
            </Link>
            <Link
              to="/partner/menu"
              className="inline-flex rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
            >
              Manage menu
            </Link>
          </div>
        </SurfaceCard>
      </div>

      <Table columns={["Order", "Lead item", "Status", "Value", "Time"]} rows={partnerOrdersRows} />
    </div>
  );
};

export const PartnerMenuPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Menu management"
        title="Keep signature dishes merchandised beautifully."
        description="Menu editing now has a destination in the router, using the existing table and card system."
        action={<Button type="button">Add new item</Button>}
      />

      <Table columns={["Item", "Category", "Price", "Status"]} rows={partnerMenuRows} />

      <div className="grid gap-5 lg:grid-cols-3">
        {partnerRestaurant.menu.flatMap((category) => category.items).slice(0, 3).map((item) => (
          <SurfaceCard key={item.name} className="space-y-4">
            <img src={item.image} alt={item.name} className="h-44 w-full rounded-[1.5rem] object-cover" />
            <div>
              <p className="font-display text-3xl font-semibold text-ink">{item.name}</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">{item.description}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{item.price}</p>
              <StatusPill label={item.badge ?? "Available"} tone={item.badge ? "info" : "success"} />
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
};

export const PartnerOrdersPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Orders"
        title="Live kitchen queue and order oversight."
        description="Partner order management is no longer a placeholder screen and can be reached directly from the dashboard navigation."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Awaiting acceptance", value: "06", tone: "warning" as const },
          { label: "Preparing now", value: "14", tone: "info" as const },
          { label: "Ready for pickup", value: "04", tone: "success" as const },
        ].map((item) => (
          <SurfaceCard key={item.label} className="space-y-3">
            <StatusPill label={item.label} tone={item.tone} />
            <p className="font-display text-5xl font-semibold text-ink">{item.value}</p>
          </SurfaceCard>
        ))}
      </div>

      <Table columns={["Order", "Lead item", "Status", "Value", "Time"]} rows={partnerOrdersRows} />
    </div>
  );
};

export const PartnerReviewsPage = () => {
  const reviews = restaurants.flatMap((restaurant) =>
    restaurant.reviews.map((review) => ({
      ...review,
      title: `${restaurant.name}: ${review.title}`,
    })),
  );

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Reviews"
        title="Guest sentiment, organized for follow-up."
        description="This page reuses the existing review card system so the partner experience stays visually aligned with the customer side."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {reviews.slice(0, 4).map((review) => (
          <ReviewCard key={`${review.author}-${review.date}-${review.title}`} {...review} />
        ))}
      </div>
    </div>
  );
};

export const PartnerEarningsPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Earnings"
        title="Revenue, settlements, and payout timing."
        description="The earnings route uses the current analytics widgets and consistent premium spacing for finance-heavy partner work."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Gross sales", value: "Rs. 2.84L", hint: "Last 7 days" },
          { label: "Platform fees", value: "Rs. 28,400", hint: "Inclusive of offers" },
          { label: "Net payout", value: "Rs. 2.12L", hint: "Expected this cycle" },
        ].map((stat) => (
          <DashboardStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <AnalyticsChart data={dashboardSeries} xKey="label" yKey="value" title="Payout trend" />
      <Table columns={["Date", "Payout", "Status", "Amount"]} rows={partnerPayoutRows} />
    </div>
  );
};

export const PartnerSettingsPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant settings"
        title="Profile, service hours, and support contacts."
        description="Settings stay lightweight and safe here, reusing the existing input fields without introducing a second dashboard pattern."
        action={<Button type="button">Save changes</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <Input label="Restaurant name" defaultValue={partnerRestaurant.name} />
          <Input label="Primary email" defaultValue="hello@saffronstory.in" />
          <IndianPhoneInput label="Contact phone" defaultValue="+91 99000 10101" />
          <Input label="Operating hours" defaultValue={`${partnerRestaurant.hours} daily`} />
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <SectionHeading title="Service status" description="Current storefront readiness." />
          <div className="flex flex-wrap gap-3">
            <StatusPill label="Accepting orders" tone="success" />
            <StatusPill label="Delivery radius active" tone="info" />
          </div>
          <p className="text-sm leading-7 text-ink-soft">
            Settings remain local UI for now and are ready to connect to restaurant profile endpoints when those page-level mutations are prioritized.
          </p>
        </SurfaceCard>
      </div>
    </div>
  );
};

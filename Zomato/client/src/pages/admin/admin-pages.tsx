import { AnalyticsChart } from "@/components/ui/analytics-chart";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { Input } from "@/components/ui/input";
import { SectionHeading, SurfaceCard } from "@/components/ui/page-shell";
import { Table } from "@/components/ui/table";
import { ReviewCard } from "@/components/cards/review-card";
import {
  adminDeliveryRows,
  adminOfferRows,
  adminPaymentsRows,
  adminRestaurantRows,
  adminStats,
  adminUserRows,
  dashboardSeries,
  orderRows,
  restaurants,
} from "@/lib/demo-data";

const settingsRows = [
  ["Serviceable cities", "Bengaluru, Hyderabad, Pune"],
  ["Default support SLA", "5 minutes"],
  ["Refund approval threshold", "Rs. 500"],
];

// Admin routes use shared datasets for now so the platform console feels complete without backend-wide refactors.
export const AdminDashboardPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin console"
        title="Platform health in one polished view."
        description="The admin area now has dedicated routes for users, operations, finance, and moderation instead of a single placeholder."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {adminStats.map((stat) => (
          <DashboardStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsChart data={dashboardSeries} xKey="label" yKey="value" title="Platform activity" />
        <SurfaceCard className="space-y-4">
          <SectionHeading title="Operational watchlist" description="High-signal platform notes for the current shift." />
          <div className="grid gap-4">
            {[
              "12 restaurants require menu refresh approval.",
              "3 payout disputes are awaiting finance review.",
              "Peak order volume expected between 8:00 PM and 9:30 PM.",
            ].map((item) => (
              <div key={item} className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm leading-7 text-ink-soft">
                {item}
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export const AdminUsersPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Users" title="Customer and operator management." description="This route fills the earlier team placeholder with a clean, table-driven overview." />
      <Table columns={["Name", "Role", "Status", "Summary"]} rows={adminUserRows} />
    </div>
  );
};

export const AdminRestaurantsPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Restaurants" title="Partner coverage and quality signals." description="Restaurant oversight now lives on its own dedicated admin route." />
      <Table columns={["Restaurant", "Area", "Rating", "Delivery time"]} rows={adminRestaurantRows} />
    </div>
  );
};

export const AdminDeliveryPartnersPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Delivery network" title="Rider verification and performance." description="This page centralizes the delivery partner management view for the admin role." />
      <Table columns={["Partner", "Shift summary", "Rating", "Status"]} rows={adminDeliveryRows} />
    </div>
  );
};

export const AdminOrdersPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Order monitoring" title="Live order visibility across the platform." description="Operational order monitoring now sits behind its own route and keeps the existing premium dashboard feel." />
      <Table columns={["Order", "Restaurant", "Status", "Total", "Placed"]} rows={orderRows} />
    </div>
  );
};

export const AdminOffersPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Offers and coupons" title="Campaign performance and schedule." description="The admin promotions surface is connected to the router and uses the shared offer dataset." />
      <Table columns={["Code", "Theme", "State", "Performance"]} rows={adminOfferRows} />
    </div>
  );
};

export const AdminPaymentsPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Payments and refunds" title="Financial flow tracking." description="Payments, settlements, and refund actions have a dedicated admin destination." />
      <Table columns={["Date", "Type", "Reference", "Amount"]} rows={adminPaymentsRows} />
    </div>
  );
};

export const AdminReviewsPage = () => {
  const reviews = restaurants.flatMap((restaurant) =>
    restaurant.reviews.map((review) => ({
      ...review,
      title: `${restaurant.name}: ${review.title}`,
    })),
  );

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Reviews moderation" title="Recent guest feedback for moderation." description="Admin review oversight reuses the current review cards so moderation feels native to the existing visual system." />
      <div className="grid gap-5 xl:grid-cols-2">
        {reviews.slice(0, 4).map((review) => (
          <ReviewCard key={`${review.author}-${review.date}-${review.title}`} {...review} />
        ))}
      </div>
    </div>
  );
};

export const AdminReportsPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Reports and analytics" title="Performance trends without leaving the admin shell." description="This route safely replaces the earlier analytics placeholder and keeps the charts already available in the app." />
      <AnalyticsChart data={dashboardSeries} xKey="label" yKey="value" title="Weekly platform report" />
      <div className="grid gap-5 lg:grid-cols-3">
        {[
          { title: "Customer retention", description: "68% repeat order rate over the last 30 days." },
          { title: "Offer redemption", description: "LUXE250 remains the strongest dinner-period driver." },
          { title: "Delivery efficiency", description: "Average out-for-delivery window is holding below 19 minutes." },
        ].map((item) => (
          <SurfaceCard key={item.title} className="space-y-3">
            <p className="font-display text-3xl font-semibold text-ink">{item.title}</p>
            <p className="text-sm leading-7 text-ink-soft">{item.description}</p>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
};

export const AdminSettingsPage = () => {
  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Platform settings" title="Operational defaults and guardrails." description="Settings are intentionally lightweight here and ready for future API mutations without changing the current route structure." />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <Input label="Support contact email" defaultValue="ops@zomatoluxe.dev" />
          <Input label="Notification sender name" defaultValue="Zomato Luxe Ops" />
          <Input label="Default city" defaultValue="Bengaluru" />
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <SectionHeading title="Current defaults" />
          <Table columns={["Setting", "Value"]} rows={settingsRows} className="border-none bg-transparent shadow-none" />
        </SurfaceCard>
      </div>
    </div>
  );
};

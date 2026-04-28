import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Store, Truck, UserRound } from "lucide-react";
import { PageShell, SectionHeading, SurfaceCard } from "@/components/ui/page-shell";

const registrationOptions = [
  {
    title: "Register as User",
    description:
      "Create a customer account and start exploring restaurants, offers, membership, search, cart, and live orders right away.",
    to: "/register/user",
    icon: UserRound,
    badge: "Instant access",
  },
  {
    title: "Register as Delivery Partner",
    description:
      "Submit identity, vehicle, license, and safe payout details through the approval-first delivery onboarding flow.",
    to: "/register/delivery-partner",
    icon: Truck,
    badge: "Pending approval",
  },
  {
    title: "Register as Restaurant Owner",
    description:
      "Share restaurant, compliance, and payout-safe onboarding details for regional manager or admin review.",
    to: "/register/restaurant-owner",
    icon: Store,
    badge: "Pending approval",
  },
] as const;

export const RegistrationSelectionPage = () => {
  return (
    <PageShell
      eyebrow="Registration"
      title="Choose the kind of Zomato Luxe account you want to open."
      description="Customer accounts activate immediately through the existing auth flow. Delivery partner and restaurant owner accounts go into the approval queue for regional manager or admin review."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6 lg:grid-cols-3">
          {registrationOptions.map((option) => {
            const Icon = option.icon;

            return (
              <Link
                key={option.to}
                to={option.to}
                className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft transition hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
                    {option.badge}
                  </span>
                </div>
                <h2 className="mt-6 font-display text-4xl font-semibold text-ink">{option.title}</h2>
                <p className="mt-3 text-sm leading-7 text-ink-soft">{option.description}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                  Continue registration
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>

        <SurfaceCard className="space-y-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <SectionHeading
            title="What stays safe"
            description="The new public registration entry uses the current white and deep-red shell without changing the existing home page structure."
          />
          <div className="space-y-3 text-sm leading-7 text-ink-soft">
            <p>User signup reuses the current live auth flow.</p>
            <p>Delivery partner and restaurant owner onboarding stays approval-based.</p>
            <p>Raw card number and CVV are never collected in partner-facing forms.</p>
            <p>Admin still sees all applications, while regional managers stay scoped to their assigned regions.</p>
          </div>
        </SurfaceCard>
      </div>
    </PageShell>
  );
};

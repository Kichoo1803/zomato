import { Bell, CreditCard, MapPin, Sparkles, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell, SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Table } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { notifications, paymentMethods, savedAddresses, walletTransactions } from "@/lib/demo-data";

const linkButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft";

export const NotificationsPage = () => {
  return (
    <PageShell
      eyebrow="Notifications"
      title="Updates that matter, without the clutter."
      description="Recent order, wallet, and restaurant alerts are organized into the same warm premium surfaces used elsewhere in the customer app."
    >
      <div className="grid gap-4">
        {notifications.map((notification, index) => (
          <SurfaceCard key={notification.id} className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-3xl font-semibold text-ink">{notification.title}</p>
                <StatusPill label={index === 0 ? "Unread" : "Read"} tone={index === 0 ? "info" : "neutral"} />
              </div>
              <p className="text-sm leading-7 text-ink-soft">{notification.message}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{notification.time}</p>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </PageShell>
  );
};

export const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <PageShell
      eyebrow="Profile"
      title={user?.fullName ?? "Your account"}
      description="Personal details, loyalty context, and quick links stay grouped in one profile destination instead of looping back to the homepage."
      actions={
        <>
          <Link to="/addresses" className={linkButtonClassName}>
            Manage addresses
          </Link>
          <Link
            to="/wallet"
            className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
          >
            Open wallet
          </Link>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Account details" description="Live session details from the existing auth store." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Email</p>
              <p className="mt-2 text-sm text-ink-soft">{user?.email ?? "you@example.com"}</p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Phone</p>
              <p className="mt-2 text-sm text-ink-soft">{user?.phone ?? "+91 90000 00000"}</p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Role</p>
              <p className="mt-2 text-sm text-ink-soft">{user?.role ?? "CUSTOMER"}</p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Wallet balance</p>
              <p className="mt-2 text-sm text-ink-soft">Rs. {(user?.walletBalance ?? 1980).toLocaleString("en-IN")}</p>
            </div>
          </div>
        </SurfaceCard>

        <div className="space-y-6">
          <SurfaceCard className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Membership tier</p>
                <h2 className="mt-2 font-display text-4xl font-semibold text-ink">Luxe Circle Gold</h2>
                <p className="mt-3 text-sm leading-7 text-ink-soft">
                  Priority delivery windows, curated member-only offers, and elevated reservation access stay attached to the customer account area.
                </p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <SectionHeading title="Quick actions" description="Route-level shortcuts for the most-used customer destinations." />
            <div className="flex flex-wrap gap-3">
              <Link to="/orders" className={linkButtonClassName}>
                View orders
              </Link>
              <Link
                to="/notifications"
                className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
              >
                Open notifications
              </Link>
              <Link
                to="/favorites"
                className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
              >
                Favorites
              </Link>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </PageShell>
  );
};

export const SavedAddressesPage = () => {
  return (
    <PageShell
      eyebrow="Addresses"
      title="Saved handoff points for every dining mood."
      description="Home, office, and occasion-ready destinations are grouped into a dedicated page instead of being hidden inside checkout."
      actions={<Button type="button">Add new address</Button>}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {savedAddresses.map((address, index) => (
          <SurfaceCard key={address.title} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-3xl font-semibold text-ink">{address.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{address.eta}</p>
                </div>
              </div>
              {index === 0 ? <StatusPill label="Default" tone="info" /> : null}
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm leading-7 text-ink-soft">
              <p>{address.line1}</p>
              <p>{address.line2}</p>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </PageShell>
  );
};

export const WalletPage = () => {
  const { user } = useAuth();
  const rows = walletTransactions.map(([date, note, amount]) => [date, note, amount]);

  return (
    <PageShell
      eyebrow="Wallet and payments"
      title="Credits, saved methods, and spend history."
      description="The wallet route now exists as its own polished destination, using the current auth session plus shared demo transactions until page-level APIs are connected."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <SurfaceCard className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Available balance</p>
                <h2 className="mt-2 font-display text-5xl font-semibold text-ink">
                  Rs. {(user?.walletBalance ?? 1980).toLocaleString("en-IN")}
                </h2>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <SectionHeading title="Saved payment methods" />
            <div className="grid gap-4">
              {paymentMethods.map((method) => (
                <div key={method.title} className="flex items-start gap-4 rounded-[1.5rem] bg-cream px-5 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-accent shadow-soft">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{method.title}</p>
                    <p className="mt-1 text-sm text-ink-soft">{method.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard className="space-y-4">
          <SectionHeading title="Recent wallet activity" description="Shared demo ledger until wallet endpoints are surfaced page-by-page." />
          <Table columns={["Date", "Activity", "Amount"]} rows={rows} className="border-none bg-transparent shadow-none" />
        </SurfaceCard>
      </div>
    </PageShell>
  );
};

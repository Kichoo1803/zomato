import {
  BarChart3,
  Bell,
  Bike,
  BriefcaseBusiness,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Map,
  MapPinned,
  MessageSquare,
  Settings,
  Shapes,
  ShoppingBag,
  Store,
  Tag,
  TicketPercent,
  UserCircle2,
  Users,
  Wallet,
  UtensilsCrossed,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useNotificationInbox } from "@/hooks/use-notification-inbox";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useAuth } from "@/hooks/use-auth";
import { getLoginRedirectPath, logoutFromServer } from "@/lib/auth";
import { getNotificationActionLabel, getNotificationHref } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const partnerNavItems = [
  { to: "/partner", label: "Overview", icon: LayoutDashboard },
  { to: "/partner/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/partner/orders", label: "Orders", icon: ShoppingBag },
  { to: "/partner/notifications", label: "Notifications", icon: Bell },
  { to: "/partner/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/partner/earnings", label: "Earnings", icon: Wallet },
  { to: "/partner/settings", label: "Settings", icon: Settings },
];

const ownerNavItems = [
  { to: "/owner/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/owner/restaurant", label: "Restaurant", icon: Store },
  { to: "/owner/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/owner/combos", label: "Combos", icon: ShoppingBag },
  { to: "/owner/addons", label: "Add-ons", icon: Tag },
  { to: "/owner/offers", label: "Offers", icon: TicketPercent },
  { to: "/owner/orders", label: "Orders", icon: ShoppingBag },
  { to: "/owner/notifications", label: "Notifications", icon: Bell },
  { to: "/owner/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/owner/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/owner/profile", label: "Profile", icon: UserCircle2 },
];

const deliveryNavItems = [
  { to: "/delivery", label: "Overview", icon: LayoutDashboard },
  { to: "/delivery/active", label: "Active", icon: Bike },
  { to: "/delivery/notifications", label: "Notifications", icon: Bell },
  { to: "/delivery/history", label: "History", icon: ShoppingBag },
  { to: "/delivery/earnings", label: "Earnings", icon: Wallet },
  { to: "/delivery/profile", label: "Profile", icon: Settings },
];

const adminNavItems = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/live-map", label: "Live map", icon: Map },
  { to: "/admin/regions", label: "Regions", icon: MapPinned },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/restaurants", label: "Restaurants", icon: Store },
  { to: "/admin/delivery-partners", label: "Delivery", icon: Bike },
  { to: "/admin/dishes", label: "Dishes", icon: UtensilsCrossed },
  { to: "/admin/combos", label: "Combos", icon: ShoppingBag },
  { to: "/admin/addons", label: "Add-ons", icon: Tag },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/offers", label: "Offers", icon: Tag },
  { to: "/admin/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/admin/categories", label: "Categories", icon: Shapes },
  { to: "/admin/notifications", label: "Alerts", icon: Bell },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/profile", label: "Profile", icon: UserCircle2 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const opsNavItems = [
  { to: "/ops/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/ops/regions", label: "Regions", icon: Map },
  { to: "/ops/restaurant-owners", label: "Owners", icon: Store },
  { to: "/ops/delivery-partners", label: "Delivery", icon: Bike },
  { to: "/ops/assignments", label: "Assignments", icon: BriefcaseBusiness },
  { to: "/ops/notifications", label: "Notifications", icon: Bell },
  { to: "/ops/communications", label: "Notes", icon: MessageSquare },
  { to: "/ops/profile", label: "Profile", icon: UserCircle2 },
];

const sectionMeta = {
  partner: {
    eyebrow: "Restaurant operations",
    title: "Partner console",
    navItems: partnerNavItems,
  },
  owner: {
    eyebrow: "Restaurant operations",
    title: "Owner control room",
    navItems: ownerNavItems,
  },
  delivery: {
    eyebrow: "Delivery operations",
    title: "Delivery console",
    navItems: deliveryNavItems,
  },
  admin: {
    eyebrow: "Platform operations",
    title: "Admin control room",
    navItems: adminNavItems,
  },
  ops: {
    eyebrow: "India operations",
    title: "Regional ops room",
    navItems: opsNavItems,
  },
} as const;

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearSession } = useAuth();
  const section = location.pathname.startsWith("/partner")
    ? "partner"
    : location.pathname.startsWith("/owner")
      ? "owner"
      : location.pathname.startsWith("/delivery")
        ? "delivery"
        : location.pathname.startsWith("/ops")
          ? "ops"
        : "admin";
  const currentSection = sectionMeta[section];
  const shouldShowRealtimeNotifications = Boolean(
    user?.role &&
      ["RESTAURANT_OWNER", "DELIVERY_PARTNER", "REGIONAL_MANAGER", "OPERATIONS_MANAGER", "ADMIN"].includes(user.role),
  );
  const { unreadCount } = useNotificationInbox({
    enabled: shouldShowRealtimeNotifications,
    userId: user?.id,
  });

  useRealtimeSubscription({
    enabled: shouldShowRealtimeNotifications,
    userId: user?.id,
    onNotification: (notification) => {
      if (!user?.role) {
        return;
      }

      const nextPath = getNotificationHref(user.role, notification);
      const actionLabel = getNotificationActionLabel(user.role, notification);

      toast(notification.title, {
        description: notification.message,
        action:
          nextPath
            ? {
                label: actionLabel,
                onClick: () => navigate(nextPath),
              }
            : undefined,
      });
    },
  });

  const handleLogout = async () => {
    try {
      await logoutFromServer();
    } catch {
      // Clear local auth state even if the backend cookie is already gone.
    } finally {
      clearSession();
      toast.success("Signed out successfully.");
      navigate(getLoginRedirectPath(location.pathname), { replace: true });
    }
  };

  return (
    <div
      className={cn(
        "mx-auto grid min-h-screen max-w-7xl gap-6 overflow-x-clip px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)]",
        section === "owner" && "lg:h-[calc(100dvh-3rem)] lg:overflow-hidden",
      )}
    >
      <aside
        className={cn(
          "glass-surface rounded-[2rem] border border-white/60 p-6 shadow-soft",
          section === "owner" && "lg:min-h-0 lg:overflow-y-auto",
        )}
      >
        <p className="text-xs uppercase tracking-[0.35em] text-ink-muted">{currentSection.eyebrow}</p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">{currentSection.title}</h1>
        <nav className="mt-8 space-y-2">
          {currentSection.navItems.map((item) => {
            const Icon = item.icon;
            const shouldUseExactMatch = item.to === "/partner" || item.to === "/delivery";
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={shouldUseExactMatch}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-ink-soft transition",
                    isActive && "bg-accent text-white shadow-soft",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.to.includes("/notifications") && unreadCount ? (
                      <span
                        className={cn(
                          "ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          isActive ? "bg-white/20 text-white" : "bg-accent/10 text-accent",
                        )}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-8 border-t border-accent/10 pt-6">
          <p className="text-sm font-semibold text-ink">{user?.fullName ?? "Signed in"}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.28em] text-ink-muted">
            {user?.role?.replace(/_/g, " ") ?? "Operator"}
          </p>
          <Button className="mt-4 w-full gap-2 rounded-2xl" variant="secondary" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <main
        className={cn(
          "glass-surface min-w-0 overflow-x-clip rounded-[2rem] border border-white/60 p-6 shadow-soft",
          section === "owner" && "lg:min-h-0 lg:overflow-hidden",
        )}
      >
        <div
          className={cn(
            "w-full min-w-0",
            section === "admin" && "overflow-x-auto pb-1",
            section === "owner" && "lg:h-full lg:overflow-y-auto lg:pr-1",
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

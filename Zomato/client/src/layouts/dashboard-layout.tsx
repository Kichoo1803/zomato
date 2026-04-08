import {
  BarChart3,
  Bike,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Users,
  Wallet,
  UtensilsCrossed,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { logoutFromServer } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const partnerNavItems = [
  { to: "/partner", label: "Overview", icon: LayoutDashboard },
  { to: "/partner/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/partner/orders", label: "Orders", icon: ShoppingBag },
  { to: "/partner/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/partner/earnings", label: "Earnings", icon: Wallet },
  { to: "/partner/settings", label: "Settings", icon: Settings },
];

const deliveryNavItems = [
  { to: "/delivery", label: "Overview", icon: LayoutDashboard },
  { to: "/delivery/active", label: "Active", icon: Bike },
  { to: "/delivery/history", label: "History", icon: ShoppingBag },
  { to: "/delivery/earnings", label: "Earnings", icon: Wallet },
  { to: "/delivery/profile", label: "Profile", icon: Settings },
];

const adminNavItems = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/restaurants", label: "Restaurants", icon: Store },
  { to: "/admin/delivery-partners", label: "Delivery", icon: Bike },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/offers", label: "Offers", icon: Tag },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const sectionMeta = {
  partner: {
    eyebrow: "Restaurant operations",
    title: "Partner console",
    navItems: partnerNavItems,
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
} as const;

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearSession } = useAuth();
  const section = location.pathname.startsWith("/partner")
    ? "partner"
    : location.pathname.startsWith("/delivery")
      ? "delivery"
      : "admin";
  const currentSection = sectionMeta[section];

  const handleLogout = async () => {
    try {
      await logoutFromServer();
    } catch {
      // Clear local auth state even if the backend cookie is already gone.
    } finally {
      clearSession();
      toast.success("Signed out successfully.");
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
      <aside className="glass-surface rounded-[2rem] border border-white/60 p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.35em] text-ink-muted">{currentSection.eyebrow}</p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">{currentSection.title}</h1>
        <nav className="mt-8 space-y-2">
          {currentSection.navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-ink-soft transition",
                    isActive && "bg-accent text-white shadow-soft",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
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
      <main className="glass-surface rounded-[2rem] border border-white/60 p-6 shadow-soft">
        <Outlet />
      </main>
    </div>
  );
};

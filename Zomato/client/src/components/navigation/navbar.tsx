import { Link, NavLink } from "react-router-dom";
import { Search, ShoppingBag, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getDefaultRedirectPath } from "@/lib/auth";
import { cn } from "@/utils/cn";

const navItems = [
  { label: "Restaurants", to: "/restaurants" },
  { label: "Offers", to: "/offers" },
  { label: "Membership", to: "/membership" },
];

export const Navbar = () => {
  const { isAuthenticated, user } = useAuth();
  const accountPath =
    isAuthenticated && user
      ? user.role === "CUSTOMER"
        ? "/profile"
        : getDefaultRedirectPath(user.role)
      : "/login";

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-sm font-extrabold tracking-[0.3em] text-white shadow-card">
            ZL
          </div>
          <div>
            <p className="font-display text-3xl font-semibold text-ink">Zomato Luxe</p>
            <p className="text-xs uppercase tracking-[0.28em] text-ink-muted">Premium delivery</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-semibold text-ink-soft transition-colors hover:text-accent",
                  isActive && "text-accent",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/search"
            className="hidden rounded-full border border-accent/10 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft lg:flex lg:items-center lg:gap-2"
          >
            <Search className="h-4 w-4 text-accent" />
            Search dishes
          </Link>
          <Link to="/cart" className="rounded-full bg-accent p-3 text-white shadow-soft">
            <ShoppingBag className="h-4 w-4" />
          </Link>
          <Link to={accountPath} className="rounded-full border border-accent/10 bg-white p-3 text-ink shadow-soft">
            <UserRound className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
};

import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { getDefaultRedirectPath } from "@/lib/auth";

type FooterProps = {
  canManageSavedLocation?: boolean;
  onOpenLocationSelector?: () => void;
  savedAddressCount?: number;
  selectedLocation?: unknown;
};

export const Footer = (_props: FooterProps) => {
  const { isAuthenticated, user } = useAuth();
  const isCustomerSession = isAuthenticated && user?.role === "CUSTOMER";
  const footerLinks = [
    { label: "Home", to: "/" },
    { label: "Restaurants", to: "/restaurants" },
    { label: "Offers", to: "/offers" },
    { label: "Membership", to: "/membership" },
    { label: "Search", to: "/search" },
    ...(isAuthenticated && user && user.role !== "CUSTOMER"
      ? [{ label: "Dashboard", to: getDefaultRedirectPath(user.role) }]
      : isCustomerSession
        ? [{ label: "Addresses", to: "/addresses" }]
        : []),
  ];

  return (
    <footer className="border-t border-accent/10 bg-white/80 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 text-sm text-ink-soft sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="font-display text-2xl font-semibold text-ink">Zomato Luxe</p>
          <p className="mt-2 max-w-md">
            Elevated food delivery, premium dining, and real-time order tracking in one seamless platform.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs uppercase tracking-[0.24em] text-ink-muted sm:flex sm:flex-wrap sm:justify-end sm:gap-6">
          {footerLinks.map((item) => (
            <Link key={item.label} to={item.to} className="transition-colors hover:text-accent">
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
};

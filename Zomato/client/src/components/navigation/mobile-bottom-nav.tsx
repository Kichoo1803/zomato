import { Search, Sparkles, Tag, UtensilsCrossed } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/utils/cn";

const items = [
  { label: "Restaurants", to: "/restaurants", icon: UtensilsCrossed },
  { label: "Offers", to: "/offers", icon: Tag },
  { label: "Membership", to: "/membership", icon: Sparkles },
  { label: "Search", to: "/search", icon: Search },
];

export const MobileBottomNav = () => {
  return (
    <nav className="fixed inset-x-4 bottom-4 z-40 rounded-[28px] border border-accent/10 bg-white/95 p-2 shadow-card backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-semibold text-ink-muted transition",
                  isActive && "bg-accent text-white shadow-soft",
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

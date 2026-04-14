import { Link } from "react-router-dom";

export const Footer = () => {
  const footerLinks = [
    { label: "Customer", to: "/" },
    { label: "Partners", to: "/partner" },
    { label: "Owner", to: "/owner" },
    { label: "Delivery", to: "/delivery" },
    { label: "Admin", to: "/admin" },
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
        <div className="grid grid-cols-2 gap-4 text-xs uppercase tracking-[0.24em] text-ink-muted sm:grid-cols-5">
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

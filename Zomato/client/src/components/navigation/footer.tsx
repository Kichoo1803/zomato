export const Footer = () => {
  return (
    <footer className="border-t border-accent/10 bg-white/80 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 text-sm text-ink-soft sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="font-display text-2xl font-semibold text-ink">Zomato Luxe</p>
          <p className="mt-2 max-w-md">
            Elevated food delivery, premium dining, and real-time order tracking in one seamless platform.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs uppercase tracking-[0.24em] text-ink-muted sm:grid-cols-4">
          <span>Customer</span>
          <span>Partners</span>
          <span>Delivery</span>
          <span>Admin</span>
        </div>
      </div>
    </footer>
  );
};

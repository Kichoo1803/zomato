import { Outlet } from "react-router-dom";

export const AuthLayout = () => {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-card backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-accent px-10 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">Zomato Luxe</p>
            <h1 className="mt-6 font-display text-6xl font-semibold leading-none">
              Elevated dining delivered beautifully.
            </h1>
          </div>
          <p className="max-w-md text-sm text-white/80">
            Customer, partner, delivery, and admin experiences with a single polished workflow.
          </p>
        </section>
        <section className="bg-white px-6 py-10 sm:px-10">
          <Outlet />
        </section>
      </div>
    </div>
  );
};

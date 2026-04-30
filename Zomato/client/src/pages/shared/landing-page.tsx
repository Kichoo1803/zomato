import { motion } from "framer-motion";

export const LandingPage = () => {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-180px)] max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div className="inline-flex rounded-full border border-accent/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.34em] text-accent shadow-soft">
            Luxury food delivery
          </div>
          <div className="space-y-5">
            <h1 className="font-display text-6xl font-semibold leading-[0.95] text-ink sm:text-7xl">
              Restaurant-quality nights, delivered with quiet confidence.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-ink-soft">
              Discover premium restaurants, curated offers, and silky-smooth live tracking across customer, partner,
              delivery, and admin experiences.
            </p>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.08 }}
          className="rounded-[2.5rem] border border-white/70 bg-white/80 p-5 shadow-card"
        >
          <div className="h-[520px] rounded-[2rem] bg-[url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center" />
        </motion.div>
      </div>
    </section>
  );
};

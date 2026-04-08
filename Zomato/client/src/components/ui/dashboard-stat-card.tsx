import { motion } from "framer-motion";

type DashboardStatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export const DashboardStatCard = ({ label, value, hint }: DashboardStatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-soft"
    >
      <p className="text-xs uppercase tracking-[0.34em] text-ink-muted">{label}</p>
      <p className="mt-4 font-display text-4xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-3 text-sm text-ink-soft">{hint}</p> : null}
    </motion.div>
  );
};

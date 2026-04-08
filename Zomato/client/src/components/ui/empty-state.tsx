type EmptyStateProps = {
  title: string;
  description: string;
};

export const EmptyState = ({ title, description }: EmptyStateProps) => {
  return (
    <div className="rounded-[2rem] border border-dashed border-accent/20 bg-white/70 px-6 py-12 text-center shadow-soft">
      <h3 className="font-display text-3xl font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-ink-soft">{description}</p>
    </div>
  );
};

import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/utils/cn";

type PageShellProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}>;

type SurfaceCardProps = PropsWithChildren<{
  className?: string;
}>;

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

type StatusPillProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

export const PageShell = ({
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: PageShellProps) => {
  return (
    <section className={cn("mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8", className)}>
      <div className="rounded-[2.5rem] border border-white/70 bg-white/80 p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">{eyebrow}</p>
            <div className="space-y-3">
              <h1 className="font-display text-5xl font-semibold text-ink sm:text-6xl">{title}</h1>
              <p className="max-w-2xl text-sm leading-7 text-ink-soft sm:text-base">{description}</p>
            </div>
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
      <div className="mt-8 space-y-8">{children}</div>
    </section>
  );
};

export const SurfaceCard = ({ className, children }: SurfaceCardProps) => {
  return (
    <div className={cn("rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-soft", className)}>
      {children}
    </div>
  );
};

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  action,
  className,
}: SectionHeadingProps) => {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-4xl font-semibold text-ink">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-7 text-ink-soft">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
};

export const StatusPill = ({ label, tone = "neutral" }: StatusPillProps) => {
  const toneClassName =
    tone === "success"
      ? "bg-[#e8f7ef] text-[#1b8a4d]"
      : tone === "warning"
        ? "bg-[#fdf0e1] text-[#a46216]"
        : tone === "info"
          ? "bg-accent/10 text-accent"
          : "bg-cream text-ink-soft";

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]", toneClassName)}>
      {label}
    </span>
  );
};

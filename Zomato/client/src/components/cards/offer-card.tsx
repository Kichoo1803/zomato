import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { StatusPill } from "@/components/ui/page-shell";

type OfferCardProps = {
  title: string;
  description: string;
  code: string;
  highlight: string;
  href?: string;
  onUnlock?: () => void;
};

export const OfferCard = ({ title, description, code, highlight, href = "/offers", onUnlock }: OfferCardProps) => {
  return (
    <article className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
      <div className="space-y-4">
        <StatusPill label={highlight} tone="info" />
        <div>
          <h3 className="font-display text-3xl font-semibold text-ink">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-ink-soft">{description}</p>
        </div>
        <div className="rounded-[1.5rem] bg-cream px-4 py-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Promo code</p>
          <p className="mt-2 text-lg font-semibold text-accent">{code}</p>
        </div>
        {onUnlock ? (
          <button
            type="button"
            onClick={onUnlock}
            className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft transition hover:border-accent/30"
          >
            Unlock offer
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <Link
            to={href}
            className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft transition hover:border-accent/30"
          >
            Unlock offer
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </article>
  );
};

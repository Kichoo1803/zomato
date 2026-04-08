import { RatingBadge } from "@/components/ui/rating-badge";

type ReviewCardProps = {
  author: string;
  title: string;
  review: string;
  rating: number;
  date: string;
};

export const ReviewCard = ({ author, title, review, rating, date }: ReviewCardProps) => {
  return (
    <article className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{date}</p>
          <h3 className="mt-3 font-display text-3xl font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-ink-soft">{author}</p>
        </div>
        <RatingBadge value={rating.toFixed(1)} />
      </div>
      <p className="mt-4 text-sm leading-7 text-ink-soft">{review}</p>
    </article>
  );
};

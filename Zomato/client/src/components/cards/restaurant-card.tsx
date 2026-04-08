import { Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { RatingBadge } from "@/components/ui/rating-badge";

type RestaurantCardProps = {
  slug: string;
  name: string;
  image: string;
  area: string;
  cuisineLabel: string;
  rating: number;
  deliveryTime: number;
  costForTwo: string;
};

export const RestaurantCard = ({
  slug,
  name,
  image,
  area,
  cuisineLabel,
  rating,
  deliveryTime,
  costForTwo,
}: RestaurantCardProps) => {
  return (
    <Link
      to={`/restaurants/${slug}`}
      className="group overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-soft transition hover:-translate-y-1 hover:shadow-card"
    >
      <div className="aspect-[1.3/1] overflow-hidden">
        <img src={image} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl font-semibold text-ink">{name}</h3>
            <p className="mt-1 text-sm text-ink-soft">{cuisineLabel}</p>
          </div>
          <RatingBadge value={rating.toFixed(1)} />
        </div>
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>{area}</span>
          <span>{costForTwo} for two</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink-soft">
          <Clock3 className="h-3.5 w-3.5 text-accent" />
          {deliveryTime} mins
        </div>
      </div>
    </Link>
  );
};

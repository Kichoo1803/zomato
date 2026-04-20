import { Clock3, Heart, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RatingBadge } from "@/components/ui/rating-badge";

type RestaurantCardProps = {
  id?: number;
  slug: string;
  name: string;
  image: string;
  area: string;
  addressSummary?: string;
  cuisineLabel: string;
  rating: number;
  deliveryTime: number;
  distanceKm?: number | null;
  costForTwo: string;
  isFavorite?: boolean;
  isFavoritePending?: boolean;
  favoriteActionLabel?: string;
  onFavoriteToggle?: () => void;
};

export const RestaurantCard = ({
  id,
  slug,
  name,
  image,
  area,
  addressSummary,
  cuisineLabel,
  rating,
  deliveryTime,
  distanceKm,
  costForTwo,
  isFavorite = false,
  isFavoritePending = false,
  favoriteActionLabel,
  onFavoriteToggle,
}: RestaurantCardProps) => {
  const distanceLabel =
    typeof distanceKm === "number" && Number.isFinite(distanceKm)
      ? `${distanceKm < 10 ? distanceKm.toFixed(1) : distanceKm.toFixed(0)} km away`
      : null;

  return (
    <div className="relative">
      {id != null && onFavoriteToggle ? (
        <Button
          type="button"
          variant="secondary"
          className="absolute right-4 top-4 z-10 gap-2 px-3 py-2 text-xs"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onFavoriteToggle();
          }}
          disabled={isFavoritePending}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
          {isFavoritePending
            ? "Saving..."
            : favoriteActionLabel ?? (isFavorite ? "Saved" : "Save")}
        </Button>
      ) : null}

      <Link
        to={`/restaurants/${slug}`}
        className="group block overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-soft transition hover:-translate-y-1 hover:shadow-card"
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
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-4 text-sm text-ink-soft">
              <span>{area}</span>
              <span className="shrink-0">{costForTwo} for two</span>
            </div>
            {addressSummary ? <p className="text-xs text-ink-muted">{addressSummary}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink-soft">
              <Clock3 className="h-3.5 w-3.5 text-accent" />
              {deliveryTime} mins
            </div>
            {distanceLabel ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/[0.06] px-3 py-1.5 text-xs font-semibold text-accent">
                <MapPin className="h-3.5 w-3.5" />
                {distanceLabel}
              </div>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
};

import { useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { PageShell, SectionHeading, SurfaceCard } from "@/components/ui/page-shell";
import { RatingBadge } from "@/components/ui/rating-badge";
import { SearchBar } from "@/components/navigation/search-bar";
import { FoodItemCard } from "@/components/cards/food-item-card";
import { OfferCard } from "@/components/cards/offer-card";
import { RestaurantCard } from "@/components/cards/restaurant-card";
import { ReviewCard } from "@/components/cards/review-card";
import {
  getRestaurantBySlug,
  membershipBenefits,
  restaurantCategories,
  restaurants,
  searchRestaurants,
  spotlightOffers,
} from "@/lib/demo-data";

const linkButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft";

export const RestaurantListingPage = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [page, setPage] = useState(1);

  const filteredRestaurants = useMemo(() => {
    if (activeCategory === "All") {
      return restaurants;
    }

    return restaurants.filter((restaurant) =>
      `${restaurant.cuisineLabel} ${restaurant.tags.join(" ")}`
        .toLowerCase()
        .includes(activeCategory.toLowerCase()),
    );
  }, [activeCategory]);

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(filteredRestaurants.length / pageSize));
  const paginatedRestaurants = filteredRestaurants.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PageShell
      eyebrow="Customer dining"
      title="Restaurants curated for polished everyday indulgence."
      description="Browse premium delivery kitchens, romantic dinner picks, pastry counters, and the city’s most dependable comfort menus."
      actions={
        <>
          <Link to="/search" className={linkButtonClassName}>
            Search everything
          </Link>
          <Link
            to="/membership"
            className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
          >
            Membership perks
          </Link>
        </>
      }
    >
      <SurfaceCard>
        <div className="space-y-5">
          <SearchBar placeholder="Search by restaurant, cuisine, or signature dish" />
          <div className="flex flex-wrap gap-3">
            {restaurantCategories.map((category) => (
              <Chip
                key={category}
                active={activeCategory === category}
                onClick={() => {
                  setActiveCategory(category);
                  setPage(1);
                }}
              >
                {category}
              </Chip>
            ))}
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {paginatedRestaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.slug} {...restaurant} />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </PageShell>
  );
};

export const SearchResultsPage = () => {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const results = searchRestaurants(params.get("q") ?? "");

  return (
    <PageShell
      eyebrow="Search"
      title="Everything worth craving, all in one place."
      description="Search across restaurants, cuisines, and signature dishes without leaving the current app shell."
      actions={
        <Button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params);
            if (query.trim()) {
              next.set("q", query.trim());
            } else {
              next.delete("q");
            }
            setParams(next);
          }}
        >
          Search now
        </Button>
      }
    >
      <SurfaceCard>
        <SearchBar
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try ‘biryani’, ‘pizza’, or ‘croissant’"
        />
      </SurfaceCard>

      <SectionHeading
        eyebrow="Search results"
        title={params.get("q") ? `Results for “${params.get("q")}”` : "Start with a dish, cuisine, or restaurant"}
        description={`${results.length} curated matches in the current demo catalogue.`}
      />

      {results.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {results.map((restaurant) => (
            <RestaurantCard key={restaurant.slug} {...restaurant} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No restaurants matched that search"
          description="Try a broader cuisine, a restaurant name, or a dish like biryani, burrata, or croissant."
        />
      )}
    </PageShell>
  );
};

export const RestaurantDetailsPage = () => {
  const { slug } = useParams();
  const restaurant = getRestaurantBySlug(slug);

  if (!restaurant) {
    return <Navigate to="/404" replace />;
  }

  return (
    <PageShell
      eyebrow={restaurant.area}
      title={restaurant.name}
      description={restaurant.heroNote}
      actions={
        <>
          <Link to="/cart" className={linkButtonClassName}>
            Go to cart
          </Link>
          <Link
            to="/favorites"
            className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
          >
            Save restaurant
          </Link>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard className="overflow-hidden p-0">
          <img src={restaurant.image} alt={restaurant.name} className="h-[420px] w-full object-cover" />
        </SurfaceCard>
        <SurfaceCard className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-ink-soft">{restaurant.cuisineLabel}</p>
              <p className="mt-3 text-sm leading-7 text-ink-soft">{restaurant.description}</p>
            </div>
            <RatingBadge value={restaurant.rating.toFixed(1)} />
          </div>
          <div className="flex flex-wrap gap-3">
            {restaurant.tags.map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Address</p>
              <p className="mt-2 text-sm text-ink-soft">{restaurant.address}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Hours</p>
              <p className="mt-2 text-sm text-ink-soft">{restaurant.hours}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Delivery time</p>
              <p className="mt-2 text-sm text-ink-soft">{restaurant.deliveryTime} min average</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cost for two</p>
              <p className="mt-2 text-sm text-ink-soft">{restaurant.costForTwo}</p>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <SectionHeading
        eyebrow="Menu"
        title="Signature dishes"
        description="A polished demo menu presentation wired to the existing card system."
      />

      <div className="space-y-6">
        {restaurant.menu.map((category) => (
          <div key={category.category} className="space-y-4">
            <h3 className="font-display text-4xl font-semibold text-ink">{category.category}</h3>
            <div className="grid gap-5">
              {category.items.map((item) => (
                <FoodItemCard key={item.name} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <SectionHeading
        eyebrow="Guest sentiment"
        title="Recent reviews"
        description="Curated review cards replace the earlier single-screen shell and keep the premium reading rhythm intact."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {restaurant.reviews.map((review) => (
          <ReviewCard key={`${review.author}-${review.date}`} {...review} />
        ))}
      </div>
    </PageShell>
  );
};

export const FavoritesPage = () => {
  return (
    <PageShell
      eyebrow="Favorites"
      title="Your most-loved dining spots."
      description="Saved restaurants remain ready for repeat orders, quicker comparison, and one-tap reordering."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {restaurants.slice(0, 4).map((restaurant) => (
          <RestaurantCard key={restaurant.slug} {...restaurant} />
        ))}
      </div>
    </PageShell>
  );
};

export const OffersPage = () => {
  return (
    <PageShell
      eyebrow="Offers"
      title="Curated savings that still feel premium."
      description="Offer cards follow the existing warm neutrals and rounded surfaces while giving the app a fuller promotions destination."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {spotlightOffers.map((offer) => (
          <OfferCard key={offer.code} {...offer} />
        ))}
      </div>
    </PageShell>
  );
};

export const MembershipPage = () => {
  return (
    <PageShell
      eyebrow="Membership"
      title="Luxe Circle membership, designed for regular indulgence."
      description="Benefit-rich but visually quiet, this page expands the membership nav route that previously looped back to the homepage."
      actions={<Button type="button">Upgrade membership</Button>}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <SurfaceCard className="space-y-4">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Current tier</p>
          <h2 className="font-display text-5xl font-semibold text-ink">Luxe Circle Gold</h2>
          <p className="text-sm leading-7 text-ink-soft">
            Built for frequent diners who want faster delivery promises, richer rewards, and priority reservation access.
          </p>
        </SurfaceCard>
        <div className="grid gap-4">
          {membershipBenefits.map((benefit) => (
            <SurfaceCard key={benefit}>
              <p className="text-sm leading-7 text-ink-soft">{benefit}</p>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </PageShell>
  );
};

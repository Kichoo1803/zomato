import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminLoadingState,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/auth";
import { getOwnerReviews, type OwnerReview } from "@/lib/owner";
import {
  PAGE_SIZE,
  RefreshButton,
  formatDateTime,
  matchesSearch,
  paginate,
} from "@/pages/admin/admin-shared";

export const OwnerReviewsPage = () => {
  const [reviews, setReviews] = useState<OwnerReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("ALL");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      setReviews(await getOwnerReviews());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load your restaurant reviews."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, []);

  const restaurantOptions = Array.from(
    new Map(reviews.map((review) => [review.restaurant.id, review.restaurant.name])).entries(),
  );

  const filteredReviews = reviews.filter((review) => {
    const haystack = `${review.user.fullName} ${review.restaurant.name} ${review.reviewText ?? ""}`;
    return (
      (!search || matchesSearch(haystack, search)) &&
      (restaurantFilter === "ALL" || String(review.restaurant.id) === restaurantFilter) &&
      (ratingFilter === "ALL" || String(review.rating) === ratingFilter)
    );
  });

  const reviewSummary = useMemo(() => {
    const base = filteredReviews.length ? filteredReviews : reviews;
    const averageRating = base.length
      ? base.reduce((sum, review) => sum + review.rating, 0) / base.length
      : 0;
    const recentComments = base.filter((review) => Boolean(review.reviewText)).length;
    const lowRatings = base.filter((review) => review.rating <= 3).length;
    const fiveStarReviews = base.filter((review) => review.rating === 5).length;

    return {
      averageRating,
      recentComments,
      lowRatings,
      fiveStarReviews,
    };
  }, [filteredReviews, reviews]);

  const pagedReviews = paginate(filteredReviews, page);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Owner reviews"
        title="Guest feedback for your restaurants."
        description="Read only the reviews tied to your own restaurants, filter sentiment by rating or restaurant, and follow the comments most likely to need attention."
        action={<RefreshButton onClick={() => void loadReviews()} />}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <DashboardStatCard label="Reviews" value={String(filteredReviews.length || reviews.length)} hint="Visible in this view" />
        <DashboardStatCard label="Average rating" value={reviewSummary.averageRating ? reviewSummary.averageRating.toFixed(1) : "0.0"} hint="Across the filtered review set" />
        <DashboardStatCard label="Five-star reviews" value={String(reviewSummary.fiveStarReviews)} hint="Strong guest sentiment" />
        <DashboardStatCard label="Reviews to watch" value={String(reviewSummary.lowRatings)} hint={`${reviewSummary.recentComments} with written comments`} />
      </div>

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by guest, restaurant, or review text"
        filters={
          <>
            <Select
              value={restaurantFilter}
              onChange={(event) => {
                setRestaurantFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[220px]"
            >
              <option value="ALL">All owned restaurants</option>
              {restaurantOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Select
              value={ratingFilter}
              onChange={(event) => {
                setRatingFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[180px]"
            >
              <option value="ALL">All ratings</option>
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} stars
                </option>
              ))}
            </Select>
          </>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedReviews.items}
            getRowKey={(review) => review.id}
            emptyTitle="No reviews found"
            emptyDescription="Your restaurant reviews will appear here after completed orders receive feedback."
            columns={[
              {
                key: "review",
                label: "Review",
                render: (review) => (
                  <div>
                    <p className="font-semibold text-ink">{review.user.fullName}</p>
                    <p className="text-xs text-ink-muted">{review.restaurant.name}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{review.reviewText ?? "No written feedback"}</p>
                  </div>
                ),
              },
              {
                key: "rating",
                label: "Rating",
                render: (review) => <StatusPill label={`${review.rating} / 5`} tone="info" />,
              },
              {
                key: "order",
                label: "Order",
                render: (review) => review.order?.orderNumber ?? "Restaurant review",
              },
              {
                key: "date",
                label: "Created",
                render: (review) => formatDateTime(review.createdAt),
              },
            ]}
          />
          {filteredReviews.length > PAGE_SIZE ? (
            <Pagination page={pagedReviews.currentPage} totalPages={pagedReviews.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
};

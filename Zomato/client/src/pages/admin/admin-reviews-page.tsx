import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminLoadingState,
  AdminToolbar,
  ConfirmDangerModal,
} from "@/components/admin/admin-ui";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { deleteReview, getReviews, type AdminReview } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  formatDateTime,
  matchesSearch,
  paginate,
} from "./admin-shared";

export const AdminReviewsPage = () => {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      setReviews(await getReviews());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load reviews."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, []);

  const filteredReviews = reviews.filter((review) => {
    const haystack = `${review.user.fullName} ${review.restaurant.name} ${review.reviewText ?? ""}`;
    return (!search || matchesSearch(haystack, search)) && (ratingFilter === "ALL" || String(review.rating) === ratingFilter);
  });

  const pagedReviews = paginate(filteredReviews, page);

  const handleDeleteReview = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteReview(deleteTarget.id);
      toast.success("Review removed successfully.");
      setDeleteTarget(null);
      await loadReviews();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to remove this review."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Reviews moderation" title="Guest sentiment and moderation controls." description="Review recent feedback, filter by rating, and remove inappropriate content with admin permissions." action={<RefreshButton onClick={() => void loadReviews()} />} />

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by guest, restaurant, or review text"
        filters={
          <Select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} className="min-w-[180px]">
            <option value="ALL">All ratings</option>
            {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}
          </Select>
        }
      />

      {isLoading ? <AdminLoadingState /> : (
        <>
          <AdminDataTable
            rows={pagedReviews.items}
            getRowKey={(review) => review.id}
            emptyTitle="No reviews found"
            emptyDescription="There are no reviews for the current filters."
            columns={[
              { key: "review", label: "Review", render: (review) => <div><p className="font-semibold text-ink">{review.user.fullName}</p><p className="text-xs text-ink-muted">{review.restaurant.name}</p><p className="mt-2 text-sm leading-6 text-ink-soft">{review.reviewText ?? "No written feedback"}</p></div> },
              { key: "rating", label: "Rating", render: (review) => <StatusPill label={`${review.rating} / 5`} tone="info" /> },
              { key: "order", label: "Order", render: (review) => review.order?.orderNumber ?? "Direct restaurant review" },
              { key: "date", label: "Created", render: (review) => formatDateTime(review.createdAt) },
              { key: "actions", label: "Actions", render: (review) => <RowActions onDelete={() => setDeleteTarget(review)} /> },
            ]}
          />
          {filteredReviews.length > PAGE_SIZE ? <Pagination page={pagedReviews.currentPage} totalPages={pagedReviews.totalPages} onPageChange={setPage} /> : null}
        </>
      )}

      <ConfirmDangerModal open={Boolean(deleteTarget)} title="Delete review" description="This permanently removes the review and recalculates the restaurant rating." confirmLabel="Delete review" isSubmitting={isDeleting} onClose={() => setDeleteTarget(null)} onConfirm={() => void handleDeleteReview()} />
    </div>
  );
};

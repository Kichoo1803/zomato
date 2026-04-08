import { Button } from "./button";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export const Pagination = ({ page, totalPages, onPageChange }: PaginationProps) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm font-semibold text-ink-soft">
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </div>
  );
};

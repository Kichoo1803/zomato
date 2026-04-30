import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/page-shell";

type PageLoadErrorStateProps = {
  title: string;
  description: string;
  onRetry: () => void;
  retryLabel?: string;
};

export const PageLoadErrorState = ({
  title,
  description,
  onRetry,
  retryLabel = "Try again",
}: PageLoadErrorStateProps) => {
  return (
    <SurfaceCard className="space-y-4">
      <EmptyState title={title} description={description} />
      <div className="flex justify-center">
        <Button type="button" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    </SurfaceCard>
  );
};

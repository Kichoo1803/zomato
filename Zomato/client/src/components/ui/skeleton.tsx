import { cn } from "@/utils/cn";

export const Skeleton = ({ className }: { className?: string }) => {
  return <div className={cn("animate-pulse rounded-2xl bg-accent/10", className)} />;
};

import { Star } from "lucide-react";

export const RatingBadge = ({ value }: { value: number | string }) => {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[#1b8a4d] px-2.5 py-1 text-xs font-bold text-white">
      <Star className="h-3 w-3 fill-current" />
      <span>{value}</span>
    </div>
  );
};

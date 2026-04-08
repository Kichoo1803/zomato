import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/page-shell";

type FoodItemCardProps = {
  name: string;
  description: string;
  price: string;
  badge?: string;
  image: string;
};

export const FoodItemCard = ({ name, description, price, badge, image }: FoodItemCardProps) => {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-soft">
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_180px] md:items-center">
        <div className="space-y-3">
          {badge ? <StatusPill label={badge} tone="info" /> : null}
          <div>
            <h3 className="font-display text-3xl font-semibold text-ink">{name}</h3>
            <p className="mt-2 text-sm leading-7 text-ink-soft">{description}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold text-ink">{price}</p>
            <Button className="gap-2" type="button">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.75rem]">
          <img src={image} alt={name} className="h-44 w-full object-cover" />
        </div>
      </div>
    </article>
  );
};

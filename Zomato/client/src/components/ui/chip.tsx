import { cn } from "@/utils/cn";

export const Chip = ({
  children,
  active,
  onClick,
}: {
  children: string;
  active?: boolean;
  onClick?: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-semibold transition",
        active
          ? "border-accent bg-accent text-white"
          : "border-accent/10 bg-white text-ink-soft hover:border-accent/30 hover:text-accent",
      )}
    >
      {children}
    </button>
  );
};

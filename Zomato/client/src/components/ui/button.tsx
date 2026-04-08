import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/utils/cn";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
  }
>;

export const Button = ({ className, variant = "primary", children, ...props }: ButtonProps) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-accent text-white shadow-soft hover:bg-accent-deep",
        variant === "secondary" && "border border-accent/15 bg-white text-ink shadow-soft hover:border-accent/30",
        variant === "ghost" && "text-ink-soft hover:bg-accent/5 hover:text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

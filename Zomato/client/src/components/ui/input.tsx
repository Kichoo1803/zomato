import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-2">
        {label ? <span className="text-sm font-semibold text-ink">{label}</span> : null}
        <input
          ref={ref}
          className={cn(
            "h-12 rounded-2xl border border-accent/10 bg-white px-4 text-sm text-ink shadow-soft outline-none transition placeholder:text-ink-muted focus:border-accent/40",
            error && "border-accent-soft",
            className,
          )}
          {...props}
        />
        {error ? <span className="text-xs font-medium text-accent-soft">{error}</span> : null}
      </label>
    );
  },
);

Input.displayName = "Input";

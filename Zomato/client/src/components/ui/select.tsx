import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, children, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-2">
        {label ? <span className="text-sm font-semibold text-ink">{label}</span> : null}
        <select
          ref={ref}
          className={cn(
            "h-12 rounded-2xl border border-accent/10 bg-white px-4 text-sm text-ink shadow-soft outline-none transition focus:border-accent/40",
            error && "border-accent-soft",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error ? <span className="text-xs font-medium text-accent-soft">{error}</span> : null}
      </label>
    );
  },
);

Select.displayName = "Select";

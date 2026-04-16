import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  trailingContent?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, trailingContent, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-2">
        {label ? <span className="text-sm font-semibold text-ink">{label}</span> : null}
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              "h-12 w-full rounded-2xl border border-accent/10 bg-white px-4 text-sm text-ink shadow-soft outline-none transition placeholder:text-ink-muted focus:border-accent/40",
              trailingContent && "pr-14",
              error && "border-accent-soft",
              className,
            )}
            {...props}
          />
          {trailingContent ? (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">{trailingContent}</div>
          ) : null}
        </div>
        {error ? <span className="text-xs font-medium text-accent-soft">{error}</span> : null}
      </label>
    );
  },
);

Input.displayName = "Input";

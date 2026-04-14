import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-2">
        {label ? <span className="text-sm font-semibold text-ink">{label}</span> : null}
        <textarea
          ref={ref}
          className={cn(
            "min-h-[120px] rounded-2xl border border-accent/10 bg-white px-4 py-3 text-sm text-ink shadow-soft outline-none transition placeholder:text-ink-muted focus:border-accent/40",
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

Textarea.displayName = "Textarea";

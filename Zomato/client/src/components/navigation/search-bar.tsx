import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/utils/cn";

type SearchBarProps = InputHTMLAttributes<HTMLInputElement> & {
  placeholder?: string;
  className?: string;
};

export const SearchBar = ({
  placeholder = "Search restaurants, cuisines, or dishes",
  className,
  ...props
}: SearchBarProps) => {
  return (
    <div className={cn("flex items-center gap-3 rounded-[1.75rem] border border-accent/10 bg-white px-4 py-3 shadow-soft", className)}>
      <Search className="h-5 w-5 text-accent" />
      <input
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        placeholder={placeholder}
        {...props}
      />
    </div>
  );
};

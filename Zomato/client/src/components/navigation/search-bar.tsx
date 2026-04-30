import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import { cn } from "@/utils/cn";

export type SearchBarSuggestion = {
  badge?: string;
  description?: string;
  icon?: ReactNode;
  id: string;
  value: string;
};

type SearchBarProps = InputHTMLAttributes<HTMLInputElement> & {
  placeholder?: string;
  className?: string;
  recentSearches?: string[];
  suggestions?: SearchBarSuggestion[];
  onClearRecentSearches?: () => void;
  onSelectRecentSearch?: (value: string) => void;
  onSelectSuggestion?: (value: string) => void;
};

export const SearchBar = ({
  placeholder = "Search restaurants, cuisines, or dishes",
  className,
  recentSearches = [],
  suggestions = [],
  onClearRecentSearches,
  onSelectRecentSearch,
  onSelectSuggestion,
  onBlur,
  onFocus,
  ...props
}: SearchBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasDiscoverabilityContent = Boolean(recentSearches.length || suggestions.length);

  useEffect(() => {
    if (!hasDiscoverabilityContent) {
      setIsOpen(false);
    }
  }, [hasDiscoverabilityContent]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const handleSuggestionSelect = (value: string, onSelect?: (nextValue: string) => void) => {
    onSelect?.(value);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-3 rounded-[1.75rem] border border-accent/10 bg-white px-4 py-3 shadow-soft">
        <Search className="h-5 w-5 text-accent" />
        <input
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          placeholder={placeholder}
          onBlur={(event) => {
            onBlur?.(event);
          }}
          onFocus={(event) => {
            if (hasDiscoverabilityContent) {
              setIsOpen(true);
            }

            onFocus?.(event);
          }}
          {...props}
        />
      </div>

      {isOpen && hasDiscoverabilityContent ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-[1.75rem] border border-accent/10 bg-white shadow-card">
          {recentSearches.length ? (
            <div className="space-y-3 border-b border-accent/10 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted">Recent searches</p>
                {onClearRecentSearches ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-accent transition hover:text-accent-soft"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onClearRecentSearches();
                      setIsOpen(false);
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((recentSearch) => (
                  <button
                    key={recentSearch}
                    type="button"
                    className="rounded-full border border-accent/10 bg-cream px-3 py-2 text-xs font-semibold text-ink-soft transition hover:border-accent/25 hover:text-accent"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestionSelect(recentSearch, onSelectRecentSearch)}
                  >
                    {recentSearch}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {suggestions.length ? (
            <div className="space-y-2 px-3 py-3">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted">Suggestions</p>
              <div className="grid gap-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="flex items-start gap-3 rounded-[1.25rem] px-3 py-3 text-left transition hover:bg-accent/[0.04]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestionSelect(suggestion.value, onSelectSuggestion)}
                  >
                    <span className="mt-0.5 text-accent">{suggestion.icon ?? <Search className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{suggestion.value}</span>
                      {suggestion.description ? (
                        <span className="mt-1 block text-xs text-ink-soft">{suggestion.description}</span>
                      ) : null}
                    </span>
                    {suggestion.badge ? (
                      <span className="shrink-0 rounded-full bg-accent/[0.08] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                        {suggestion.badge}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

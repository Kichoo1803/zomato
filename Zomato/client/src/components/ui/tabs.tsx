import { cn } from "@/utils/cn";

type TabItem = {
  value: string;
  label: string;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
};

export const Tabs = ({ items, value, onChange }: TabsProps) => {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full flex-nowrap overflow-x-auto rounded-full border border-accent/10 bg-white p-1 shadow-soft"
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          role="tab"
          aria-selected={item.value === value}
          className={cn(
            "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition",
            item.value === value && "bg-accent text-white shadow-soft",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

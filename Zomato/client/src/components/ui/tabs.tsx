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
    <div className="inline-flex rounded-full border border-accent/10 bg-white p-1 shadow-soft">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition",
            item.value === value && "bg-accent text-white",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

import { cn } from "@/utils/cn";

type TableProps = {
  columns: string[];
  rows: Array<Array<string | number>>;
  className?: string;
};

export const Table = ({ columns, rows, className }: TableProps) => {
  return (
    <div className={cn("overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-soft", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-accent/10">
          <thead className="bg-cream-soft/80">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.28em] text-ink-muted">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-accent/10">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-5 py-4 text-sm text-ink-soft">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

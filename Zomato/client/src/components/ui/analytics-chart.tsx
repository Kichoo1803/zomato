import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type AnalyticsChartProps = {
  data: Array<Record<string, number | string>>;
  xKey: string;
  yKey: string;
  title: string;
};

export const AnalyticsChart = ({ data, xKey, yKey, title }: AnalyticsChartProps) => {
  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-soft">
      <h3 className="font-display text-3xl font-semibold text-ink">{title}</h3>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="analyticsGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#8b1e24" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#8b1e24" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#eadfd4" strokeDasharray="3 3" />
            <XAxis dataKey={xKey} stroke="#8e7d77" />
            <YAxis stroke="#8e7d77" />
            <Tooltip />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke="#8b1e24"
              strokeWidth={2}
              fill="url(#analyticsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

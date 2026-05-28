"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const EMERALD = "#059669";
const AMBER = "#f59e0b";
const SLATE = "#94a3b8";

const axisProps = {
  stroke: SLATE,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 13,
} as const;

export function OrdersBarChart({
  data,
}: {
  data: { day: string; orders: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="day" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="orders" fill={EMERALD} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueLineChart({
  data,
}: {
  data: { day: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="day" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => `£${v}`} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [`£${v.toFixed(2)}`, "Revenue"]}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke={AMBER}
          strokeWidth={2.5}
          dot={{ r: 3, fill: AMBER }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PopularItemsChart({
  data,
}: {
  data: { name: string; qty: number }[];
}) {
  if (data.length === 0) {
    return <EmptyChart label="No item data yet" />;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 34)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
      >
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          {...axisProps}
          tick={{ fontSize: 12, fill: "#475569" }}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="qty" fill={EMERALD} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BusiestHoursChart({
  data,
}: {
  data: { hour: string; orders: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.orders));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="hour" {...axisProps} interval={2} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.orders >= max * 0.75 ? AMBER : EMERALD}
              fillOpacity={0.4 + (d.orders / max) * 0.6}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">
      {label}
    </div>
  );
}

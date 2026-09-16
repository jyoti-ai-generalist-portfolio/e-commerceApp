"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function RevenueChart({ data, isLoading, interval, onIntervalChange, onExport }) {
  return (
    <div className="rounded-sm border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink2">Revenue</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-sm border border-hairline">
            {["daily", "weekly", "monthly"].map((opt) => (
              <button
                key={opt}
                onClick={() => onIntervalChange(opt)}
                className={`px-3 py-1 text-[13px] capitalize ${
                  interval === opt ? "bg-ink text-white" : "bg-surface text-muted hover:bg-canvas"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            onClick={onExport}
            className="rounded-sm border border-hairline px-3 py-1 text-[13px] text-ink2 hover:bg-canvas"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mt-4 h-64">
        {isLoading ? (
          <div className="h-full w-full animate-pulse rounded bg-canvas" />
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-muted">
            No revenue recorded for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E2E4E9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v).toLocaleString()}`, "Revenue"]}
                contentStyle={{ borderRadius: 2, borderColor: "#E2E4E9" }}
              />
              <Line type="monotone" dataKey="revenue" stroke="#2F6F4E" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

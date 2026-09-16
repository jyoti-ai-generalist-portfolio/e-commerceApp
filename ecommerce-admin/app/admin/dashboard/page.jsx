"use client";

import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../../components/AdminSidebar";
import AdminTopBar from "../../../components/AdminTopBar";
import KpiCard from "../../../components/KpiCard";
import RevenueChart from "../../../components/RevenueChart";
import RecentOrdersTable from "../../../components/RecentOrdersTable";

function rangeToDates(range) {
  const end = new Date();
  const start = new Date();
  if (range === "today") start.setHours(0, 0, 0, 0);
  else if (range === "7d") start.setDate(end.getDate() - 7);
  else start.setDate(end.getDate() - 30); // default / 30d / custom fallback
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

// UC-13: Store Admin - Dashboard
export default function AdminDashboardPage() {
  const [admin, setAdmin] = useState(null);
  const [range, setRange] = useState("30d");
  const [interval, setInterval_] = useState("daily");
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const { startDate, endDate } = useMemo(() => rangeToDates(range), [range]);

  async function loadSession() {
    const res = await fetch("/api/v1/admin/auth/me");
    const body = await res.json();
    if (body.success) setAdmin(body.data.admin);
    else window.location.href = "/admin/login";
  }

  async function loadMetrics() {
    setIsLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/v1/admin/dashboard/metrics?${params.toString()}`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      setMetrics(body.data);
    } catch (err) {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  function handleExport() {
    const params = new URLSearchParams({ format: "csv", startDate, endDate });
    window.open(`/api/v1/admin/dashboard/export?${params.toString()}`, "_blank");
  }

  const kpis = metrics?.kpis;

  return (
    <div className="flex min-h-screen bg-canvas">
      <AdminSidebar active="Dashboard" />

      <div className="flex-1">
        <AdminTopBar admin={admin} range={range} onRangeChange={setRange} />

        <main className="px-6 py-6">
          <h1 className="font-display text-2xl text-ink2">Overview</h1>
          <p className="mt-1 text-[13px] text-muted">
            Performance for the selected period, updated in real time.
          </p>

          {loadError ? (
            <div className="mt-6 rounded-sm border border-alert/30 bg-alert/10 p-6 text-center">
              <p className="text-[14px] text-alert">Unable to fetch performance data.</p>
              <button
                onClick={loadMetrics}
                className="mt-3 rounded-sm border border-alert/40 px-4 py-2 text-[13px] text-alert hover:bg-alert/10"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Total revenue"
                  value={kpis ? `$${kpis.total_revenue.toLocaleString()}` : "—"}
                  changePct={kpis?.revenue_change_pct}
                  accentColor="#2F6F4E"
                  isLoading={isLoading}
                />
                <KpiCard
                  label="Total orders"
                  value={kpis ? kpis.total_orders.toLocaleString() : "—"}
                  changePct={kpis?.orders_change_pct}
                  accentColor="#14213D"
                  isLoading={isLoading}
                />
                <KpiCard
                  label="Average order value"
                  value={kpis ? `$${kpis.avg_order_value.toFixed(2)}` : "—"}
                  changePct={kpis?.aov_change_pct}
                  accentColor="#6B7280"
                  isLoading={isLoading}
                />
                <KpiCard
                  label="Low stock items"
                  value={kpis ? kpis.low_stock_count.toLocaleString() : "—"}
                  accentColor="#B3432B"
                  isLoading={isLoading}
                  href="/admin/catalog?filter=low_stock"
                />
              </div>

              <div className="mt-4">
                <RevenueChart
                  data={metrics?.revenue_chart || []}
                  isLoading={isLoading}
                  interval={interval}
                  onIntervalChange={setInterval_}
                  onExport={handleExport}
                />
              </div>

              <div className="mt-4">
                <RecentOrdersTable orders={metrics?.recent_orders || []} isLoading={isLoading} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

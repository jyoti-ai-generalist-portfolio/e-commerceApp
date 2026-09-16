import { NextResponse } from "next/server";
import { verifyAdminToken, getTokenFromRequest } from "../../../../../../lib/jwt";
import { supabaseAdmin } from "../../../../../../lib/supabaseClient";

function requireAdmin(request) {
  const token = getTokenFromRequest(request);
  const payload = token ? verifyAdminToken(token) : null;
  return payload; // null if unauthenticated / not an admin
}

function daysBetween(start, end) {
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

// Buckets orders into day/week/month intervals depending on range length,
// so a 7-day view shows daily points and a 90-day view stays readable.
function bucketKey(date, spanDays) {
  const d = new Date(date);
  if (spanDays <= 31) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (spanDays <= 120) {
    // ISO week bucket
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return d.toISOString().slice(0, 7); // YYYY-MM
}

export async function GET(request) {
  const admin = requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const endDate = searchParams.get("endDate")
    ? new Date(searchParams.get("endDate"))
    : new Date();
  const startDate = searchParams.get("startDate")
    ? new Date(searchParams.get("startDate"))
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const spanDays = daysBetween(startDate, endDate);
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanDays * 24 * 60 * 60 * 1000);

  try {
    // Current period orders (excluding cancelled, per UC-13 spec).
    const { data: currentOrders, error: ordersErr } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, status, created_at, customer_id")
      .neq("status", "cancelled")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());
    if (ordersErr) throw ordersErr;

    const { data: prevOrders, error: prevErr } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount")
      .neq("status", "cancelled")
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString());
    if (prevErr) throw prevErr;

    // supabase-js filters compare a column to a literal, not another column,
    // so the stock_quantity <= low_stock_threshold check runs in JS below.
    const { data: stockRows, error: stockErr } = await supabaseAdmin
      .from("products")
      .select("stock_quantity, low_stock_threshold");
    if (stockErr) throw stockErr;
    const lowStockCount = stockRows.filter(
      (p) => p.stock_quantity <= p.low_stock_threshold
    ).length;

    // --- KPI math ---
    const totalRevenue = currentOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const totalOrders = currentOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0; // guards divide-by-zero

    const prevRevenue = prevOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const prevOrderCount = prevOrders.length;
    const prevAov = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;

    const pctChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    // --- revenue time series ---
    const buckets = new Map();
    for (const order of currentOrders) {
      const key = bucketKey(order.created_at, spanDays);
      buckets.set(key, (buckets.get(key) || 0) + Number(order.total_amount));
    }
    const revenueChart = Array.from(buckets.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }));

    // --- recent orders (top 5, most recent first) ---
    const { data: recent, error: recentErr } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, status, created_at, customer_id, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(5);
    if (recentErr) throw recentErr;

    const recentOrders = recent.map((o) => ({
      order_id: o.id,
      customer_name: o.profiles?.full_name || "Guest",
      created_at: o.created_at,
      total: Number(o.total_amount),
      status: o.status,
    }));

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          total_revenue: Number(totalRevenue.toFixed(2)),
          revenue_change_pct: pctChange(totalRevenue, prevRevenue),
          total_orders: totalOrders,
          orders_change_pct: pctChange(totalOrders, prevOrderCount),
          avg_order_value: Number(avgOrderValue.toFixed(2)),
          aov_change_pct: pctChange(avgOrderValue, prevAov),
          low_stock_count: lowStockCount || 0,
        },
        revenue_chart: revenueChart,
        recent_orders: recentOrders,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Unable to fetch performance data." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { verifyAdminToken, getTokenFromRequest } from "../../../../../../lib/jwt";
import { supabaseAdmin } from "../../../../../../lib/supabaseClient";

function toCsvRow(fields) {
  return fields
    .map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`)
    .join(",");
}

export async function GET(request) {
  const token = getTokenFromRequest(request);
  const admin = token ? verifyAdminToken(token) : null;
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (format !== "csv") {
    return NextResponse.json(
      { success: false, error: "Only format=csv is currently supported." },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from("orders")
    .select("id, total_amount, status, created_at, customer_id, profiles(full_name)")
    .order("created_at", { ascending: false });

  if (startDate) query = query.gte("created_at", new Date(startDate).toISOString());
  if (endDate) query = query.lte("created_at", new Date(endDate).toISOString());

  const { data: orders, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, error: "Unable to generate export." },
      { status: 500 }
    );
  }

  const header = toCsvRow(["Order ID", "Customer Name", "Total Amount", "Status", "Created At"]);
  const rows = orders.map((o) =>
    toCsvRow([
      o.id,
      o.profiles?.full_name || "Guest",
      Number(o.total_amount).toFixed(2),
      o.status,
      o.created_at,
    ])
  );
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="orders-export-${Date.now()}.csv"`,
    },
  });
}

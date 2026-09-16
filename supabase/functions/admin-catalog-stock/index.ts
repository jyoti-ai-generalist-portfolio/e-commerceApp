// supabase/functions/admin-catalog-stock/index.ts
//
// PATCH /admin-catalog-stock/:id   body: { delta: number, reason?: string }
//
// DEVIATION: the use case's request example sends an absolute value
// ({"stock_quantity": 85}), but its own Edge Cases section explicitly warns
// against that ("Concurrent Stock Overwrites... use atomic DB updates
// (stock_quantity = stock_quantity + :delta) rather than replacing with
// absolute values"). We follow the edge-case guidance: this endpoint takes
// a signed delta and applies it atomically via the adjust_product_stock()
// Postgres function (see migrations/20260916_catalog_management.sql), and
// logs every change to inventory_logs. The front end's stock stepper (+/-)
// naturally produces a delta rather than an absolute number.

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireAdmin, serviceClient, AdminAuthError } from "../_shared/adminAuth.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "PATCH") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    await requireAdmin(req);
    const supabase = serviceClient();
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments[segments.length - 1];

    if (!id) {
      return jsonResponse({ success: false, error: "Product id is required." }, 400);
    }

    const body = await req.json();
    const delta = Number(body.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      return jsonResponse(
        { success: false, error: "delta must be a non-zero integer (e.g. 5 or -5)." },
        400,
      );
    }

    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "admin_adjustment";

    const { data, error } = await supabase.rpc("adjust_product_stock", {
      p_product_id: id,
      p_delta: delta,
      p_reason: reason,
    });

    if (error) {
      const isNegativeStock = error.code === "23514";
      const isNotFound = error.code === "P0002";
      return jsonResponse(
        {
          success: false,
          error: isNegativeStock
            ? "This adjustment would take stock below zero."
            : isNotFound
            ? "Product not found."
            : error.message,
        },
        isNegativeStock ? 409 : isNotFound ? 404 : 500,
      );
    }

    return jsonResponse({ success: true, data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return jsonResponse({ success: false, error: err.message }, err.status);
    }
    console.error(err);
    return jsonResponse({ success: false, error: "Internal server error." }, 500);
  }
});

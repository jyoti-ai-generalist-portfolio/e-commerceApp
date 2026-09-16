// supabase/functions/admin-catalog-products/index.ts
//
// POST   /admin-catalog-products      -> create product
// PUT    /admin-catalog-products/:id  -> update product
// DELETE /admin-catalog-products/:id  -> soft-delete (is_published = false)
// GET    /admin-catalog-products      -> paginated list for the admin table
//        supports ?page=&pageSize=&category_id=&search=
//
// DEVIATION: the use case's "Data Structure Schema" section defines a
// singular, NOT NULL `image_url`, but its own request-payload example sends
// `image_urls` (an array) — and your real schema has `image_urls _text`
// (nullable array), no `image_url` column. This function follows your real
// schema: `image_urls`, optional, 1-5 URLs.

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireAdmin, serviceClient, AdminAuthError } from "../_shared/adminAuth.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_RE = /^https?:\/\/\S+$/i;

function validateProductPayload(body: Record<string, unknown>, isUpdate: boolean) {
  const errors: Record<string, string> = {};

  if (!isUpdate || body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 3 || title.length > 150) {
      errors.title = "product_title must be 3-150 characters.";
    }
  }

  if (!isUpdate || body.category_id !== undefined) {
    if (typeof body.category_id !== "string" || !UUID_RE.test(body.category_id)) {
      errors.category_id = "category_id must be a valid UUID.";
    }
  }

  if (!isUpdate || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      errors.price = "price must be a decimal greater than 0.00.";
    }
  }

  if (!isUpdate || body.stock_quantity !== undefined) {
    const qty = Number(body.stock_quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      errors.stock_quantity = "stock_quantity must be an integer >= 0.";
    }
  }

  if (!isUpdate || body.low_stock_threshold !== undefined) {
    const threshold = Number(body.low_stock_threshold);
    if (!Number.isInteger(threshold) || threshold < 0) {
      errors.low_stock_threshold = "low_stock_threshold must be an integer >= 0.";
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      errors.description = "description must be text.";
    }
  }

  if (body.image_urls !== undefined && body.image_urls !== null) {
    const urls = body.image_urls;
    if (!Array.isArray(urls) || urls.length > 5 || !urls.every((u) => typeof u === "string" && URL_RE.test(u))) {
      errors.image_urls = "image_urls must be an array of up to 5 valid URLs.";
    }
  }

  return errors;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    await requireAdmin(req);
    const supabase = serviceClient();
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments[segments.length - 1] !== "admin-catalog-products"
      ? segments[segments.length - 1]
      : null;

    if (req.method === "GET") {
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const pageSize = Math.min(100, Number(url.searchParams.get("pageSize")) || 20);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("products")
        .select("*, categories(id, name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      const categoryId = url.searchParams.get("category_id");
      if (categoryId) query = query.eq("category_id", categoryId);

      const search = url.searchParams.get("search");
      if (search) query = query.ilike("title", `%${search}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return jsonResponse({ success: true, data, page, pageSize, total: count });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const isUpdate = req.method === "PUT";
      if (isUpdate && !id) {
        return jsonResponse({ success: false, error: "Product id is required for update." }, 400);
      }

      const body = await req.json();
      const errors = validateProductPayload(body, isUpdate);
      if (Object.keys(errors).length > 0) {
        return jsonResponse({ success: false, error: "Validation failed.", fields: errors }, 400);
      }

      if (body.category_id !== undefined) {
        const { data: category, error: categoryError } = await supabase
          .from("categories")
          .select("id")
          .eq("id", body.category_id)
          .eq("is_active", true)
          .maybeSingle();
        if (categoryError) throw categoryError;
        if (!category) {
          return jsonResponse(
            { success: false, error: "category_id does not match an active category." },
            400,
          );
        }
      }

      const record: Record<string, unknown> = {};
      for (const key of [
        "category_id",
        "title",
        "description",
        "price",
        "stock_quantity",
        "low_stock_threshold",
        "image_urls",
        "is_published",
      ]) {
        if (body[key] !== undefined) record[key] = body[key];
      }
      if (isUpdate) record.updated_at = new Date().toISOString();

      const query = isUpdate
        ? supabase.from("products").update(record).eq("id", id)
        : supabase.from("products").insert(record);

      const { data, error } = await query.select("*, categories(id, name)").single();

      if (error) {
        const isDuplicate = error.code === "23505";
        return jsonResponse(
          {
            success: false,
            error: isDuplicate ? "Duplicate entry. Product already exists." : error.message,
          },
          isDuplicate ? 409 : 500,
        );
      }

      return jsonResponse({ success: true, data }, isUpdate ? 200 : 201);
    }

    if (req.method === "DELETE") {
      if (!id) return jsonResponse({ success: false, error: "Product id is required." }, 400);
      const { data, error } = await supabase
        .from("products")
        .update({ is_published: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return jsonResponse({ success: false, error: err.message }, err.status);
    }
    console.error(err);
    return jsonResponse({ success: false, error: "Internal server error." }, 500);
  }
});

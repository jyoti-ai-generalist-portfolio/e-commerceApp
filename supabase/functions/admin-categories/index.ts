// supabase/functions/admin-categories/index.ts
//
// Admin category management: POST create, PUT update, DELETE soft-delete.
//
// GET    /admin-categories            -> list all categories (incl. inactive, for the admin grid)
// POST   /admin-categories            -> create { name, slug }
// PUT    /admin-categories/:id        -> update { name?, slug? }
// DELETE /admin-categories/:id        -> soft-delete (sets is_active = false)
//
// DEVIATION: the use case's own schema snippet marks categories<->products
// as ON DELETE RESTRICT and asks for "soft-deleting categories". We soft-
// delete only (is_active = false, added in the migration) — we never
// attempt a hard DELETE, so the RESTRICT constraint never actually fires
// from this endpoint. If you later add a genuine hard-delete admin action,
// keep the "reassign or delete linked products first" 400 the use case
// describes for that path.

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireAdmin, serviceClient, AdminAuthError } from "../_shared/adminAuth.ts";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateName(name: unknown) {
  if (typeof name !== "string") return "category_name is required.";
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return "category_name must be 2-50 characters.";
  }
  return null;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    await requireAdmin(req);
    const supabase = serviceClient();
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments[segments.length - 1] !== "admin-categories"
      ? segments[segments.length - 1]
      : null;

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, is_active, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const nameError = validateName(body.name);
      if (nameError) {
        return jsonResponse({ success: false, error: nameError }, 400);
      }
      const slug = body.slug ? slugify(body.slug) : slugify(body.name);

      const { data, error } = await supabase
        .from("categories")
        .insert({ name: body.name.trim(), slug })
        .select()
        .single();

      if (error) {
        const isDuplicate = error.code === "23505";
        return jsonResponse(
          {
            success: false,
            error: isDuplicate
              ? "A category with this name or slug already exists."
              : error.message,
          },
          isDuplicate ? 409 : 500,
        );
      }
      return jsonResponse({ success: true, data }, 201);
    }

    if (req.method === "PUT") {
      if (!id) return jsonResponse({ success: false, error: "Category id is required." }, 400);
      const body = await req.json();
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) {
        const nameError = validateName(body.name);
        if (nameError) return jsonResponse({ success: false, error: nameError }, 400);
        updates.name = body.name.trim();
      }
      if (body.slug !== undefined) updates.slug = slugify(body.slug);

      const { data, error } = await supabase
        .from("categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        const isDuplicate = error.code === "23505";
        return jsonResponse(
          {
            success: false,
            error: isDuplicate
              ? "A category with this name or slug already exists."
              : error.message,
          },
          isDuplicate ? 409 : 500,
        );
      }
      return jsonResponse({ success: true, data });
    }

    if (req.method === "DELETE") {
      if (!id) return jsonResponse({ success: false, error: "Category id is required." }, 400);

      const { count, error: countError } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id)
        .eq("is_published", true);
      if (countError) throw countError;

      const { data, error } = await supabase
        .from("categories")
        .update({ is_active: false })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      return jsonResponse({
        success: true,
        data,
        warning: count && count > 0
          ? `${count} published product(s) still reference this category. Reassign or unpublish them if you want the category fully retired.`
          : undefined,
      });
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

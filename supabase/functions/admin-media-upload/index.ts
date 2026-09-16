// supabase/functions/admin-media-upload/index.ts
//
// POST /admin-media-upload   multipart/form-data, field name: "file"
// Returns: { success: true, data: { url, path } }
//
// Uploads directly to the public "images" bucket. The project_id in the
// returned public URL comes from SUPABASE_URL at runtime (never hardcode
// it), matching the use case's instruction to read project_id from an
// environment variable.

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireAdmin, serviceClient, AdminAuthError } from "../_shared/adminAuth.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const BUCKET = "images";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    await requireAdmin(req);

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonResponse(
        { success: false, error: "Expected multipart/form-data." },
        400,
      );
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return jsonResponse({ success: false, error: "No file field found." }, 400);
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return jsonResponse(
        { success: false, error: "Only JPEG, PNG, and WebP images are allowed." },
        400,
      );
    }

    if (file.size > MAX_BYTES) {
      return jsonResponse(
        { success: false, error: "File exceeds the 5MB limit." },
        400,
      );
    }

    const uniqueName = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, "-")}`;
    const buffer = new Uint8Array(await file.arrayBuffer());

    const supabase = serviceClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(uniqueName, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return jsonResponse(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        500,
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(uniqueName);

    return jsonResponse({
      success: true,
      data: { url: publicUrlData.publicUrl, path: uniqueName },
    }, 201);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return jsonResponse({ success: false, error: err.message }, err.status);
    }
    console.error(err);
    return jsonResponse({ success: false, error: "Internal server error." }, 500);
  }
});

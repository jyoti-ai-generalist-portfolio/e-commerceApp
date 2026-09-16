// supabase/functions/_shared/cors.ts
// Shared CORS headers so every admin edge function responds consistently
// to the front-end origin(s). Adjust ALLOWED_ORIGIN via env if you need
// to restrict this to your production domain instead of "*".

export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

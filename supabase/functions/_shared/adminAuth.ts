// supabase/functions/_shared/adminAuth.ts
//
// DEVIATION FROM USE CASE 19 SPEC: the use case assumes a `role === 'admin'`
// JWT claim. Your actual schema has no role column anywhere — it has a
// standalone `admins` table (admin_email, admin_name) instead. So "is this
// caller an admin" is answered by looking up their authenticated email in
// `admins`, not by reading a claim. This helper does that lookup and is
// shared by every admin-catalog-* function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function serviceClient() {
  // Service-role client: bypasses RLS. Only ever used server-side, after
  // requireAdmin() has verified the caller. Never expose this key to the
  // front end.
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the caller's JWT and confirms their email exists in `admins`.
 * Throws AdminAuthError (401 for bad/missing token, 403 for authenticated
 * non-admin) on failure. Returns the authenticated user on success.
 * 
 * MODIFICATION: Natively short-circuits and authorizes if a trusted
 * server-side service key is used to invoke the function.
 */
export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new AdminAuthError("Missing bearer token.", 401);
  }

  // 1. SECURE SHORT-CIRCUIT: Check if this is an internal Next.js Server Action call
  if (token === SERVICE_ROLE_KEY) {
    return {
      user: { id: "system-action", email: "server-action@system.internal" },
      admin: { id: "system", admin_email: "server-action@system.internal", admin_name: "System Server Action" }
    };
  }

  // 2. FALLBACK: Handle standard direct browser/mobile client application requests
  const supabase = serviceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(
    token,
  );

  if (userError || !userData?.user) {
    throw new AdminAuthError("Invalid or expired session.", 401);
  }

  const user = userData.user;
  if (!user.email) {
    throw new AdminAuthError("Session has no associated email.", 403);
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id, admin_email, admin_name")
    .eq("admin_email", user.email)
    .maybeSingle();

  if (adminError) {
    throw new AdminAuthError("Could not verify admin status.", 500);
  }

  if (!adminRow) {
    throw new AdminAuthError("This account is not an admin.", 403);
  }

  return { user, admin: adminRow };
}

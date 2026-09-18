// supabase/functions/_shared/adminAuth.ts

import { createClient } from "https://esm.sh";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function serviceClient() {
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
 * Supports Google OAuth configurations and Next.js backend Server Action triggers.
 */
export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new AdminAuthError("Missing bearer token.", 401);
  }

  // 1. TRUSTED BACKEND SHORT-CIRCUIT:
  // If the request uses your secure master system key, authorize it immediately
  if (token === SERVICE_ROLE_KEY) {
    return {
      user: { id: "system-action", email: "server-action@system.internal" },
      admin: { id: "system", admin_email: "server-action@system.internal", admin_name: "System Server Action" }
    };
  }

  // 2. OAUTH FALLBACK: Handle direct browser traffic signatures
  const supabase = serviceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  console.log("Inside supabase Edge function oAuth code - token was ",token);
  console.log("Inside supabase Edge function oAuth code - userData ",userData);
  if (userError || !userData?.user) {
    throw new AdminAuthError("Invalid or expired session.", 401);
  }

  const user = userData.user;
  
  // Google Auth users sometimes store their email in user_metadata instead of the root key
  const adminEmail = user.email || user.user_metadata?.email;
  
  if (!adminEmail) {
    throw new AdminAuthError("Session has no associated email identity.", 403);
  }

  // 3. DATABASE VERIFICATION GATEKEEPER
  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id, admin_email, admin_name")
    .eq("admin_email", adminEmail)
    .maybeSingle();

  if (adminError) {
    throw new AdminAuthError("Could not verify admin status.", 500);
  }

  if (!adminRow) {
    throw new AdminAuthError("This account is not an admin.", 403);
  }

  return { user, admin: adminRow };
}

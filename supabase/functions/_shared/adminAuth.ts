// supabase/functions/_shared/adminAuth.ts

import jwt from "npm:jsonwebtoken";
// 🌟 FIX: Use the standard Deno/ESM import syntax at the top of the file
import { createClient } from "npm:@supabase/supabase-js"; 

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.name = "AdminAuthError";
  }
}

/**
 * Validates the custom Next.js admin token on incoming edge requests
 */
export async function requireAdmin(req: Request) {
  const adminToken = req.headers.get("X-Admin-Token");
  if (!adminToken) {
    throw new AdminAuthError("Access Denied: Missing administrative token context.", 401);
  }

  const jwtSecret = Deno.env.get("JWT_SECRET");
  if (!jwtSecret) {
    console.error("CRITICAL: JWT_SECRET environment variable is missing on this Supabase Edge container.");
    throw new AdminAuthError("Internal configuration error.", 500);
  }

  try {
    const payload = jwt.verify(adminToken, jwtSecret) as any;
    
    if (payload.role !== "admin") {
      throw new AdminAuthError("Access Denied: Account lacks administrator privileges.", 403);
    }
    
    return payload;
  } catch (err) {
    throw new AdminAuthError("Access Denied: Your administrator session has expired or is invalid.", 401);
  }
}

/**
 * 🌟 FIX: Cleaned up client initializer without using Node.js 'require'
 */
export function serviceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, supabaseServiceKey);
}

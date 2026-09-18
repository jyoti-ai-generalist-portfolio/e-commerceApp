import jwt from "npm:jsonwebtoken";

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
    
    // Return payload context if your endpoints need access to admin metadata (e.g., payload.email)
    return payload;
  } catch (err) {
    throw new AdminAuthError("Access Denied: Your administrator session has expired or is invalid.", 401);
  }
}

/**
 * Kept intact for your database handler layer inside index.ts
 */
export function serviceClient() {
  const { createClient } = require("npm:@supabase/supabase-js");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, supabaseServiceKey);
}

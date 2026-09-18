import { serve } from "https://deno.land"
import * as djwt from "https://deno.land"

serve(async (req) => {
  // 1. Get the admin token forwarded from Next.js
  const adminToken = req.headers.get("X-Admin-Token");
  if (!adminToken) {
    return new Response(JSON.stringify({ error: "Unauthorized: Missing Admin Token" }), { status: 401 });
  }

  try {
    // 2. Import your JWT Secret Key inside the edge function environment
    const jwtSecret = Deno.env.get("JWT_SECRET") || ""; 
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // 3. Verify the token signature matches your Next.js app
    const payload = await djwt.verify(adminToken, cryptoKey);
    
    console.log("Edge function acting on behalf of Admin:", payload.email);
    
    // Now proceed with your backend logic securely...
    
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid Admin Session Token" }), { status: 403 });
  }
})

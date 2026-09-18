import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Public URL is fine
// SECURE: Removed NEXT_PUBLIC_ so it never leaks to the browser
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 


console.log("Supabase URL found inside supabaseClient.js", supabaseUrl);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "Supabase server env vars are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});



// lib/supabaseBrowserClient.js (or similar)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// lib/supabaseBrowserClient.js
const dbSchema = process.env.NEXT_PUBLIC_DB_SCHEMA || "public";


console.log ("inside supabaseBrowserClient ", supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: dbSchema },
});

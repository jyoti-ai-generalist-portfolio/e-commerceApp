// Server-only Supabase helpers for use inside Next.js Route Handlers.
// Never import this file from a Client Component.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pulls the Supabase access token out of the Authorization: Bearer header.
export function getBearerToken(request) {
  const header =
    request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

// Anon-key client with no user context — for genuinely public reads
// (published products, active categories) and for auth.signInWithPassword /
// auth.signUp calls that don't need an existing session.
export function getAnonSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Anon-key client that forwards the caller's own JWT, so Postgres RLS
// policies evaluate auth.uid() as that user. Use this for every
// cart/profile read or write.
export function getAuthedSupabase(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

// Service-role client that bypasses RLS entirely. Use sparingly and only
// for trusted server-side operations (e.g. writing the profile/address
// rows immediately after sign-up, before a client session may exist).
export function getServiceSupabase() {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// Resolves the Supabase user for a given access token, or null if the
// token is missing/invalid/expired.
export async function getUserFromToken(accessToken) {
  if (!accessToken) return null;
  const supabase = getAuthedSupabase(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

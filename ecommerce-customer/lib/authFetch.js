// lib/authFetch.js
import { supabase } from './supabaseClient'; // Adjusted path to use your existing file

/**
 * A wrapper around the native fetch API that automatically injects
 * the active user's Supabase access token (JWT) into the headers.
 */
export async function authFetch(url, options = {}) {
  // 1. Get the current active session from the browser client memory/cookies
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  // 2. Return standard fetch initialized with authorization headers
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      // If the user is logged in, attach their JWT token as a Bearer token
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

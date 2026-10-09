// Server-only helpers for the /api/v1/customer/orders routes.
// NOTE: if lib/supabaseServer.js already exports a "user client from bearer token"
// helper, replace getCustomerContext() with it - the routes only need { supabase, user }.
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// lib/customerOrdersServer.js (Partial snippet showing the update)
import { getBearerToken, getUserFromToken, getAuthedSupabase } from './supabaseServer'; // Adjust the import path as needed


export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// products(title) resolves only for published products (RLS); unpublished ones come back null.
export const ORDER_SELECT = `
  id, total_amount, status, order_shipping_status, delivery_date, tracking_number, created_at,  shipping_address,
  order_items ( id, product_id, quantity, price_at_purchase, products ( title ) ),
  returns ( id, reason, status, created_at )
`;

export function jsonError(message, status, code) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Replaces Claude's fallback client creation logic with your clean, 
 * production-ready supabaseServer.js pipeline.
 */
export async function getCustomerContext(request) {
  
  
  // 1. Pull the token out of the Authorization header injected by your authFetch
  const token = getBearerToken(request);
  if (!token) return null;
  
  // 2. Validate the token and retrieve the user object securely from Supabase
  const user = await getUserFromToken(token);
  if (!user) return null;
  
  
  // 3. Create a short-lived server client safely scoped to this specific authenticated user
  const supabase = getAuthedSupabase(token);
  
// Return the context object exactly as your routes expect it
  return {
    supabase, user
  };

}

export function normalizeOrder(o) {
  return {
    ...o,
    shipping_address: o.shipping_address || {}, // Explicity pass the shipping_address as an object, even if it's null
    order_items: (o.order_items || []).map((i) => ({
      id: i.id,
      product_id: i.product_id,
      title: i.products?.title || 'Product no longer available',
      quantity: i.quantity,
      price_at_purchase: i.price_at_purchase,
    })),
    returns: [...(o.returns || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  };
}

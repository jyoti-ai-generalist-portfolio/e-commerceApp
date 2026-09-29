// /app/api/v1/orders/[id]/returns/route.js

import { NextResponse } from 'next/server';
// Fix 1: Adjusted stepping levels from 7 levels out down to 5 levels out
import { getCustomerContext, jsonError, UUID_RE } from '../../../../../lib/customerOrdersServer';
import {
  REQUEST_PREFIX, RETURN_WINDOW_DAYS, hasActiveRequest, isReturnWindowOpen,
} from '../../../../../lib/orderRules';

export const dynamic = 'force-dynamic';

// POST /api/v1/orders/:id/returns   body: { request_type: 'CANCEL'|'RETURN', reason }
export async function POST(request, { params }) {
  // Uses the updated getCustomerContext that relies on getAuthedSupabase(token)
  const ctx = await getCustomerContext(request);
  if (!ctx) return jsonError('Please sign in to continue.', 401, 'UNAUTHENTICATED');
  if (!UUID_RE.test(params.id)) return jsonError('Order not found.', 404, 'NOT_FOUND');

  let body;
  try { 
    body = await request.json(); 
  } catch { 
    return jsonError('Invalid request body.', 400, 'BAD_JSON'); 
  }

  const type = body?.request_type;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (type !== 'CANCEL' && type !== 'RETURN') return jsonError('request_type must be CANCEL or RETURN.', 400, 'BAD_TYPE');
  if (reason.length < 5) return jsonError('Please enter a reason (at least 5 characters).', 400, 'REASON_REQUIRED');
  if (reason.length > 500) return jsonError('Reason must be 500 characters or fewer.', 400, 'REASON_TOO_LONG');

  // Queries using the authenticated instance with Row Level Security (RLS) active
  // Ownership: RLS + explicit filter; a foreign order id simply returns nothing.
  const { data: order, error } = await ctx.supabase
    .from('orders')
    .select('id, status, order_shipping_status, delivery_date, returns ( id, status )')
    .eq('id', params.id)
    .eq('customer_id', ctx.user.id)
    .maybeSingle();

  if (error) return jsonError('Could not verify your order.', 500, 'QUERY_FAILED');
  if (!order) return jsonError('Order not found.', 404, 'NOT_FOUND');

  if (order.status !== 'paid')
    return jsonError('Only paid orders can be cancelled or returned.', 409, 'NOT_PAID');
  if (hasActiveRequest(order))
    return jsonError('A cancellation/return request already exists for this order.', 409, 'DUPLICATE_REQUEST');

  if (type === 'CANCEL') {
    if (['Delivered', 'Cancelled'].includes(order.order_shipping_status))
      return jsonError('This order can no longer be cancelled.', 409, 'NOT_CANCELLABLE');
  } else {
    if (order.order_shipping_status !== 'Delivered')
      return jsonError('Only delivered orders can be returned.', 409, 'NOT_DELIVERED');
    if (!isReturnWindowOpen(order))
      return jsonError(`The ${RETURN_WINDOW_DAYS}-day return window for this order has expired.`, 422, 'WINDOW_EXPIRED');
  }

  // The returns table has no request_type column, so the type is stored as a reason prefix.
  const { data: created, error: insertErr } = await ctx.supabase
    .from('returns')
    .insert({ order_id: order.id, reason: REQUEST_PREFIX[type] + reason, status: 'Requested' })
    .select('id, reason, status, created_at')
    .single();

  if (insertErr) {
    console.error('returns insert failed:', insertErr.message);
    return jsonError('Could not submit your request. Please try again.', 500, 'INSERT_FAILED');
  }

  // Fix 2 Note: Returns { request: created }. If your frontend expects { data: created } instead, 
  // you can safely change the key name below.
  return NextResponse.json({ request: created }, { status: 201 });
}

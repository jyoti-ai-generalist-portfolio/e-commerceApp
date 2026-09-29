// PATCH /api/v1/admin/orders/:id/shipping-status
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/requireAdmin';
import { sendShippingEmail } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];

export async function PATCH(request, { params }) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const status = body?.order_shipping_status;
  const tracking = typeof body?.tracking_number === 'string' ? body.tracking_number.trim() : '';
  if (!ALLOWED.includes(status)) return NextResponse.json({ error: 'Invalid order_shipping_status' }, { status: 400 });
  if (status === 'Shipped' && !tracking) return NextResponse.json({ error: 'tracking_number is required when status is Shipped' }, { status: 400 });
  if (tracking.length > 100) return NextResponse.json({ error: 'tracking_number too long' }, { status: 400 });

  const { data: order, error: readErr } = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, status, order_shipping_status, tracking_number')
    .eq('id', params.id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'paid') return NextResponse.json({ error: 'Only paid orders can be updated' }, { status: 409 });
  if (['Cancelled', 'Delivered'].includes(order.order_shipping_status)) {
    return NextResponse.json({ error: `Order is already ${order.order_shipping_status}` }, { status: 409 });
  }
  if (order.order_shipping_status === status && (status !== 'Shipped' || order.tracking_number === tracking)) {
    return NextResponse.json({ ok: true, unchanged: true, order });
  }

  const patch = { order_shipping_status: status, updated_at: new Date().toISOString() };
  if (status === 'Shipped') patch.tracking_number = tracking;
  if (status === 'Delivered') patch.delivery_date = new Date().toISOString();

  // Compare-and-set on the previous status so two admins cannot double-fire emails.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('orders')
    .update(patch)
    .eq('id', order.id)
    .eq('order_shipping_status', order.order_shipping_status)
    .select('id, total_amount, order_shipping_status, tracking_number, delivery_date')
    .maybeSingle();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Order was changed by someone else. Refresh and retry.' }, { status: 409 });

  const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', order.customer_id).maybeSingle();
  const email = await sendShippingEmail({ to: profile?.email, name: profile?.full_name, order: updated, status });

  return NextResponse.json({ ok: true, order: updated, email });
}

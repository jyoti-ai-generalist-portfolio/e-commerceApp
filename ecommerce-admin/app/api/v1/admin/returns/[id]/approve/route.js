// POST /api/v1/admin/returns/:id/approve
// Razorpay refund first, then the EXISTING approve_refund_restore() RPC does the atomic DB work
// (orders.status, Cancelled shipping status, returns.status, stock restore + inventory_logs).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/requireAdmin';
import { getRazorpay } from '@/lib/razorpayAdmin';
import { sendRefundEmail } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  let body = {};
  try { body = await request.json(); } catch {}
  const returnId = params.id;
  if (body.return_id && body.return_id !== returnId) return NextResponse.json({ error: 'return_id mismatch' }, { status: 400 });

  const { data: ret, error: retErr } = await supabaseAdmin.from('returns').select('id, order_id, status').eq('id', returnId).maybeSingle();
  if (retErr) return NextResponse.json({ error: retErr.message }, { status: 500 });
  if (!ret) return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  if (body.order_id && body.order_id !== ret.order_id) return NextResponse.json({ error: 'order_id mismatch' }, { status: 400 });
  if (ret.status !== 'Requested') return NextResponse.json({ error: `Return is already ${ret.status}` }, { status: 409 });

  const { data: order, error: ordErr } = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, total_amount, status, order_shipping_status, razorpay_order_id')
    .eq('id', ret.order_id)
    .maybeSingle();
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'paid') return NextResponse.json({ error: `Order status is ${order.status}; nothing to refund` }, { status: 409 });
  if (!order.razorpay_order_id) return NextResponse.json({ error: 'Order has no Razorpay order id' }, { status: 422 });

  // 1) Razorpay refund. The payment id is not stored in our DB (verify route never writes payment_records),
  //    so look it up from the Razorpay order. Safe to retry: an already-refunded payment is not refunded twice.
  const rzp = getRazorpay();
  let refundIds = [];
  try {
    const { items } = await rzp.orders.fetchPayments(order.razorpay_order_id);
    const payment = items.find((p) => ['captured', 'refunded'].includes(p.status));
    if (!payment) return NextResponse.json({ error: 'No captured Razorpay payment found for this order' }, { status: 422 });
    if (payment.amount !== Math.round(Number(order.total_amount) * 100)) {
      return NextResponse.json({ error: 'Payment amount does not match order total; refund blocked' }, { status: 409 });
    }
    const remaining = payment.amount - (payment.amount_refunded || 0);
    if (remaining > 0) {
      const refund = await rzp.payments.refund(payment.id, {
        amount: remaining,
        speed: 'normal',
        notes: { order_id: order.id, return_id: ret.id },
      });
      refundIds = [refund.id];
    } else {
      const existing = await rzp.payments.fetchMultipleRefund(payment.id);
      refundIds = existing.items.map((r) => r.id);
    }
  } catch (e) {
    // Nothing has been changed in our DB, so stock and statuses stay as they were.
    console.error('Razorpay refund failed:', e?.error?.description || e.message);
    return NextResponse.json({ error: `Razorpay refund failed: ${e?.error?.description || e.message}` }, { status: 502 });
  }

  // 2) Existing atomic RPC: statuses + stock restore + inventory_logs in one transaction.
  //    CONFIRM these parameter names against supabase/migrations/20260929051207_approve_refund_restore.sql
  const { error: rpcErr } = await supabaseAdmin.rpc('approve_refund_restore', {
    p_order_id: order.id,
    p_return_id: ret.id,
    p_is_cancellation: order.order_shipping_status !== 'Delivered',
  });
  if (rpcErr) {
    console.error('approve_refund_restore failed after refund', { refundIds, returnId, msg: rpcErr.message });
    return NextResponse.json(
      { error: 'Refund was issued on Razorpay but the database update failed. Click Approve Refund again; the refund will not be repeated.', refund_ids: refundIds },
      { status: 500 }
    );
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', order.customer_id).maybeSingle();
  const email = await sendRefundEmail({ to: profile?.email, name: profile?.full_name, order, refundIds });

  return NextResponse.json({ ok: true, refund_ids: refundIds, email });
}

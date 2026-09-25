import { NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../../lib/supabaseServer';
import { verifyRazorpayWebhookSignature } from '../../../../../lib/razorpayServer';

// This route is called by Razorpay's servers, never by the browser —
// there is no user JWT here. It must use the service-role client
// (RLS bypass) and trust ONLY what the verified webhook signature
// confirms, not any customer-supplied Authorization header.
//
// Configure this URL in the Razorpay dashboard: Settings → Webhooks →
// add https://<your-domain>/api/v1/webhooks/razorpay, subscribe to
// "payment.captured" and "payment.failed", and copy the generated
// secret into RAZORPAY_WEBHOOK_SECRET.
export async function POST(request) {
  // Must read the raw body BEFORE any JSON parsing — Razorpay signs the
  // exact raw bytes, and request.json() would consume the stream and
  // also silently reformat whitespace, breaking the signature check.
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  let isValid;
  try {
    isValid = verifyRazorpayWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error('Webhook signature check failed to run:', err);
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  if (!isValid) {
    console.warn('Razorpay webhook: invalid signature, rejecting');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    //if (event.event === 'payment.captured') {
    // Standardize event detection to handle both triggers smoothly
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      // Extract the Razorpay Order ID depending on the event structure
      let razorpayOrderId = null;
      let paymentEntity = null;

      if (event.event === 'order.paid') {
        // order.paid contains the order entity directly in the payload
        razorpayOrderId = event.payload?.order?.entity?.id;
        // Grab the payment details if embedded or fallback
        paymentEntity = event.payload?.payment?.entity; 
      } else if (event.event === 'payment.captured') {
        // payment.captured passes the payment entity natively
        paymentEntity = event.payload?.payment?.entity;
        razorpayOrderId = paymentEntity?.order_id;
      }

      //const payment = event.payload?.payment?.entity;
      //const razorpayOrderId = payment?.order_id;
      if (!razorpayOrderId) {
        return NextResponse.json({ error: 'Missing order_id in payload' }, { status: 400 });
      }

       // Query your database for the matching Razorpay Order ID
      const { data: order, error: findError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle();
      if (findError) throw findError;

      if (!order) {
        // This stops retries if the order is genuinely missing, but logs it clearly
        console.error(`Webhook ${event.event}: No matching row found in Supabase for Razorpay ID ${razorpayOrderId}`);
        return NextResponse.json({ received: true });
      }
      /*
      const { data: order, error: findError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle();
      if (findError) throw findError;

      if (!order) {
        // Order not found — log and acknowledge anyway so Razorpay
        // doesn't keep retrying indefinitely for an order we can't match.
        console.error('Webhook payment.captured: no matching order for', razorpayOrderId);
        return NextResponse.json({ received: true });
      } */

      // Idempotent: the browser callback (/api/v1/payments/verify) may
      // have already marked this paid. Only act if it's still pending.
      if (order.status === 'pending_payment') {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('id', order.id);
        if (updateError) throw updateError;

        // Clear that customer's persistent cart, same as the callback
        // route does — the webhook may be the ONLY confirmation that
        // ever arrives if the browser callback never fired.
        const { data: fullOrder } = await supabase
          .from('orders')
          .select('customer_id')
          .eq('id', order.id)
          .single();
        if (fullOrder?.customer_id) {
          const { data: cart } = await supabase
            .from('carts')
            .select('id')
            .eq('profile_id', fullOrder.customer_id)
            .maybeSingle();
          if (cart) {
            await supabase.from('cart_items').delete().eq('cart_id', cart.id);
          }
        }
      } else if (order.status === 'payment_failed') {
        // The abandoned-order cron already marked this failed and
        // released its reserved stock (trg_order_payment_failed_release_stock),
        // but Razorpay now confirms the payment actually captured. Money
        // moved — try to re-reserve the same stock and honor the order;
        // if stock is gone (sold to someone else in the meantime), flag
        // for a refund instead of silently failing.
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, products ( title )')
          .eq('order_id', order.id);
        if (itemsError) throw itemsError;

        let stockReserveFailed = null;
        for (const item of items || []) {
          const { error: stockError } = await supabase.rpc('adjust_product_stock', {
            p_product_id: item.product_id,
            p_delta: -item.quantity,
            p_reason: 'webhook_reconciliation_reserve',
          });
          if (stockError) {
            stockReserveFailed = item;
            break;
          }
        }

        if (stockReserveFailed) {
          // Could not re-reserve — do NOT mark paid, since we can't
          // fulfill it. Flag loudly for a refund; this needs a human
          // (or a follow-up automated refund call, out of scope here).
          console.error(
            `REFUND NEEDED: order ${order.id}, payment ${payment.id} captured by Razorpay, ` +
              `but "${stockReserveFailed.products?.title}" is out of stock and cannot be ` +
              `re-reserved. Customer was charged; order cannot be fulfilled as-is. ` +
              `Initiate a refund for this payment_id via the Razorpay dashboard or API.`
          );
          await supabase
            .from('orders')
            .update({ status: 'payment_failed' }) // stays failed; refund is the correct outcome
            .eq('id', order.id);
        } else {
          const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', order.id);
          if (updateError) throw updateError;

          console.warn(
            `RECONCILED: order ${order.id} was auto-failed by the abandonment sweep, ` +
              `then confirmed paid by Razorpay webhook. Stock re-reserved successfully.`
          );

          const { data: fullOrder } = await supabase
            .from('orders')
            .select('customer_id')
            .eq('id', order.id)
            .single();
          if (fullOrder?.customer_id) {
            const { data: cart } = await supabase
              .from('carts')
              .select('id')
              .eq('profile_id', fullOrder.customer_id)
              .maybeSingle();
            if (cart) {
              await supabase.from('cart_items').delete().eq('cart_id', cart.id);
            }
          }
        }
      }
    }

    // Other event types (refund, dispute, etc.) are acknowledged but
    // not yet handled — add cases here as needed.
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Razorpay webhook processing failed:', err);
    // Still 200 vs 500 matters to Razorpay's retry behavior — a 500
    // tells Razorpay to retry, which is correct here since we want
    // another attempt at processing, not silent data loss.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

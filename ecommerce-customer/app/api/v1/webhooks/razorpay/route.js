import { NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../../lib/supabaseServer';
import { verifyRazorpayWebhookSignature } from '../../../../../lib/razorpayServer';
import { sendOrderConfirmationEmail } from '../../../../../lib/mailer';

// Helper to clear cart & send order confirmation email via SMTP (non-blocking)
async function finalizeConfirmedOrder(supabase, orderId) {
  const { data: fullOrder } = await supabase
    .from('orders')
    .select(`
      id,
      customer_id,
      subtotal,
      tax_amount,
      shipping_fee,
      total_amount,
      profiles ( email, full_name ),
      order_items (
        quantity,
        price_at_purchase,
        products ( title )
      )
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (!fullOrder) return;

  // 1. Clear customer's persistent cart
  if (fullOrder.customer_id) {
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', fullOrder.customer_id)
      .maybeSingle();
    if (cart) {
      await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    }
  }

  // 2. Send order confirmation email via SMTP
  try {
    const recipientEmail = fullOrder.profiles?.email;
    if (recipientEmail) {
      const items = (fullOrder.order_items || []).map((item) => ({
        title: item.products?.title || 'Product',
        quantity: item.quantity,
        price_at_purchase: item.price_at_purchase,
      }));

      await sendOrderConfirmationEmail({
        to: recipientEmail,
        name: fullOrder.profiles?.full_name || '',
        orderId: fullOrder.id,
        items,
        totals: {
          subtotal: fullOrder.subtotal,
          tax_amount: fullOrder.tax_amount,
          shipping_fee: fullOrder.shipping_fee,
          total_amount: fullOrder.total_amount,
        },
      });
    }
  } catch (emailErr) {
    console.error(`Webhook order confirmation email failed for order ${orderId}:`, emailErr);
  }
}

export async function POST(request) {
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
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      let razorpayOrderId = null;
      let paymentEntity = null;

      if (event.event === 'order.paid') {
        razorpayOrderId = event.payload?.order?.entity?.id;
        paymentEntity = event.payload?.payment?.entity;
      } else if (event.event === 'payment.captured') {
        paymentEntity = event.payload?.payment?.entity;
        razorpayOrderId = paymentEntity?.order_id;
      }

      if (!razorpayOrderId) {
        return NextResponse.json({ error: 'Missing order_id in payload' }, { status: 400 });
      }

      const { data: order, error: findError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle();
      if (findError) throw findError;

      if (!order) {
        console.error(`Webhook ${event.event}: No matching row found in Supabase for Razorpay ID ${razorpayOrderId}`);
        return NextResponse.json({ received: true });
      }

      // Idempotent: if /api/v1/payments/verify already marked this 'paid',
      // both branches below are skipped so no duplicate email is sent.
      if (order.status === 'pending_payment') {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('id', order.id);
        if (updateError) throw updateError;

        await finalizeConfirmedOrder(supabase, order.id);
      } else if (order.status === 'payment_failed') {
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
          console.error(
            `REFUND NEEDED: order ${order.id}, payment ${paymentEntity?.id || 'unknown'} captured by Razorpay, ` +
              `but "${stockReserveFailed.products?.title}" is out of stock and cannot be ` +
              `re-reserved. Customer was charged; order cannot be fulfilled as-is. ` +
              `Initiate a refund for this payment_id via the Razorpay dashboard or API.`
          );
          await supabase
            .from('orders')
            .update({ status: 'payment_failed' })
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

          await finalizeConfirmedOrder(supabase, order.id);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Razorpay webhook processing failed:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

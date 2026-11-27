// app/api/v1/payments/verify/route.js

import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken } from '../../../../../lib/supabaseServer';
import { verifyRazorpaySignature } from '../../../../../lib/razorpayServer';
import { sendOrderConfirmationEmail } from '../../../../../lib/mailer';

export async function POST(request) {
  try {
    const token = getBearerToken(request);
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};

    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
    }

    const supabase = getAuthedSupabase(token);

    // Load the order and confirm it belongs to this user AND that the
    // razorpay_order_id matches what we generated at order-creation time
    // (defends against a forged/replayed order_id from the client).
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_id,
        razorpay_order_id,
        status,
        subtotal,
        tax_amount,
        shipping_fee,
        total_amount,
        order_items (
          quantity,
          price_at_purchase,
          products ( title )
        )
      `)
      .eq('id', order_id)
      .maybeSingle();
    if (orderError) throw orderError;

    if (!order || order.customer_id !== user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.razorpay_order_id !== razorpay_order_id) {
      return NextResponse.json({ error: 'Order/payment mismatch' }, { status: 400 });
    }
    if (order.status === 'paid') {
      // Idempotent: verification may be called more than once.
      return NextResponse.json({ message: 'Order already confirmed', order_id: order.id });
    }

    const isValid = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) {
      // Signature failed — mark the order so it's not left ambiguously
      // "pending" forever, but do NOT decrement stock or clear the cart.
      await supabase.from('orders').update({ status: 'payment_failed' }).eq('id', order.id);
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    // Signature valid — mark paid.
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', order.id);
    if (updateError) throw updateError;

    // Clear the persistent cart now that the order is confirmed.
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (cart) {
      await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    }

    // Send order confirmation email via SMTP (non-blocking).
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .maybeSingle();

      const recipientEmail = profile?.email || user.email;
      if (recipientEmail) {
        const items = (order.order_items || []).map((item) => ({
          title: item.products?.title || 'Product',
          quantity: item.quantity,
          price_at_purchase: item.price_at_purchase,
        }));

        await sendOrderConfirmationEmail({
          to: recipientEmail,
          name: profile?.full_name || '',
          orderId: order.id,
          items,
          totals: {
            subtotal: order.subtotal,
            tax_amount: order.tax_amount,
            shipping_fee: order.shipping_fee,
            total_amount: order.total_amount,
          },
        });
      }
    } catch (emailErr) {
      console.error('Order confirmation email failed to send:', emailErr);
    }

    return NextResponse.json({ message: 'Payment verified', order_id: order.id });
  } catch (err) {
    console.error('POST /api/v1/payments/verify failed:', err);
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}

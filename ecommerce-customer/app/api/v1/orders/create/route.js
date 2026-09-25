import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken, getServiceSupabase } from '../../../../../lib/supabaseServer';
import { getRazorpayClient } from '../../../../../lib/razorpayServer';

const TAX_RATE = 0.18;
const FREE_SHIPPING_THRESHOLD = 5000;
const SHIPPING_FLAT_FEE = 99;

export async function POST(request) {
  try {
    const token = getBearerToken(request);
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const shipping_address = body?.shipping_address;
    if (!shipping_address?.address_line1 || !shipping_address?.pincode) {
      return NextResponse.json({ error: 'A valid shipping address is required' }, { status: 400 });
    }

    const supabase = getAuthedSupabase(token);
    // Service-role client used ONLY for adjust_product_stock(), which is
    // security definer / service_role-only. Everything else in this
    // route stays on the user's own authed client, RLS-scoped.
    const serviceSupabase = getServiceSupabase();

    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (cartError) throw cartError;
    if (!cart) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const { data: cartItems, error: itemsError } = await supabase
      .from('cart_items')
      .select('product_id, quantity, products ( id, title, price, stock_quantity, is_published )')
      .eq('cart_id', cart.id);
    if (itemsError) throw itemsError;

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const unavailable = cartItems.filter(
      (i) => !i.products || !i.products.is_published || i.products.stock_quantity < i.quantity
    );
    if (unavailable.length > 0) {
      return NextResponse.json(
        {
          error: 'Some items in your cart are no longer available in the requested quantity',
          unavailable: unavailable.map((i) => i.product_id),
        },
        { status: 409 }
      );
    }

    const subtotal = cartItems.reduce((sum, i) => sum + i.quantity * Number(i.products.price), 0);
    const tax = Math.round(subtotal * TAX_RATE);
    const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_FEE;
    const totalAmount = subtotal + tax + shippingFee;

    // 1. Create the draft order in 'Pending' status.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        total_amount: totalAmount,
        status: 'pending_payment',
        shipping_address,
      })
      .select('id, total_amount')
      .single();
    if (orderError) throw orderError;

    // 2. Snapshot the order_items at today's price.
    const orderItemsPayload = cartItems.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      quantity: i.quantity,
      price_at_purchase: i.products.price,
    }));
    const { error: orderItemsError } = await supabase.from('order_items').insert(orderItemsPayload);
    if (orderItemsError) throw orderItemsError;

    // 3. Reserve stock now — before Razorpay is even contacted. Each
    // call is atomic and raises if it would go negative, so a race
    // between two concurrent checkouts on the last unit surfaces here
    // as a clean 409, not as a payment-verify failure after money moved.
    for (const item of cartItems) {
      const { error: stockError } = await serviceSupabase.rpc('adjust_product_stock', {
        p_product_id: item.product_id,
        p_delta: -item.quantity,
        p_reason: 'order_reserved',
      });
      if (stockError) {
        // Roll back the draft order/order_items — they must not be left
        // dangling with no reserved stock behind them.
        await supabase.from('order_items').delete().eq('order_id', order.id);
        await supabase.from('orders').delete().eq('id', order.id);
        return NextResponse.json(
          { error: `Not enough stock for "${item.products.title}"`, product_id: item.product_id },
          { status: 409 }
        );
      }
    }

    // 4. Create the matching Razorpay order. Amount is in paise.
    const rzp = getRazorpayClient();
    const rzpOrder = await rzp.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: order.id,
      notes: { supabase_order_id: order.id },
    });

    // 5. Store the Razorpay order id so /payments/verify can cross-check it.
    const { error: linkError } = await supabase
      .from('orders')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', order.id);
    if (linkError) throw linkError;

    return NextResponse.json({
      order_id: order.id,
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    });
  } catch (err) {
    console.error('POST /api/v1/orders/create failed:', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
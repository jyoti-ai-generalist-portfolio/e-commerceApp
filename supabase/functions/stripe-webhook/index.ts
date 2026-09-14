// supabase/functions/stripe-webhook/index.ts
//
// Receives Stripe webhook events. On a successful checkout it inserts the
// order + order_items rows (using the service role, bypassing RLS), which
// in turn fires the `trg_order_placed` DB trigger -> order-confirmation
// Edge Function -> Resend email.
//
// Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// (must be --no-verify-jwt because Stripe calls this anonymously and
// authenticates via its own signature instead)
//
// Register this URL as an endpoint in the Stripe Dashboard:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
// Subscribe to event: checkout.session.completed

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret
    );
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Expect cart contents + shipping address to have been passed as
    // metadata when the Checkout Session was created.
    const profileId = session.metadata?.profile_id;
    const cartId = session.metadata?.cart_id;
    const shippingAddress = session.metadata?.shipping_address
      ? JSON.parse(session.metadata.shipping_address)
      : {};

    if (!profileId || !cartId) {
      console.error("Missing profile_id / cart_id in session metadata");
      return new Response("Missing metadata", { status: 400 });
    }

    // Pull the cart items to snapshot price_at_purchase
    const { data: cartItems, error: cartErr } = await supabaseAdmin
      .from("cart_items")
      .select("product_id, quantity, products(price, stock_quantity)")
      .eq("cart_id", cartId);

    if (cartErr || !cartItems || cartItems.length === 0) {
      console.error("Could not load cart items:", cartErr);
      return new Response("Cart lookup failed", { status: 500 });
    }

    const totalAmount = (session.amount_total ?? 0) / 100;

    // 1. Insert the order — this INSERT fires trg_order_placed
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: profileId,
        total_amount: totalAmount,
        status: "Pending",
        shipping_address: shippingAddress,
      })
      .select()
      .single();

    if (orderErr) {
      console.error("Order insert failed:", orderErr);
      return new Response("Order insert failed", { status: 500 });
    }

    // 2. Insert order_items + deduct stock
    for (const item of cartItems) {
      await supabaseAdmin.from("order_items").insert({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: (item as any).products.price,
      });

      await supabaseAdmin.rpc("decrement_stock", {
        p_product_id: item.product_id,
        p_qty: item.quantity,
      });
    }

    // 3. Clear the cart
    await supabaseAdmin.from("cart_items").delete().eq("cart_id", cartId);

    return new Response(JSON.stringify({ received: true, order_id: order.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ignore other event types
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});

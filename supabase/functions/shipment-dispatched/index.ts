// supabase/functions/shipment-dispatched/index.ts
//
// Fired by `trg_order_shipped` when orders.status transitions to 'Shipped'.
// Emails the customer with the carrier tracking link.
//
// Deploy with: supabase functions deploy shipment-dispatched

import { sendEmail } from "../_shared/resend.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const { order_id } = await req.json();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, tracking_number, profiles ( email, full_name )")
    .eq("id", order_id)
    .single();

  if (error || !order) {
    console.error("shipment-dispatched: order lookup failed", error);
    return new Response("Order not found", { status: 404 });
  }

  const carrierUrl = order.tracking_number
    ? `https://www.trackingmore.com/track/en/${order.tracking_number}`
    : null;

  const html = `
    <h2>Your order is on its way, ${(order.profiles as any).full_name ?? "there"}!</h2>
    <p>Order <strong>#${order.id}</strong> has shipped.</p>
    ${
      order.tracking_number
        ? `<p>Tracking number: <strong>${order.tracking_number}</strong></p>
           <p><a href="${carrierUrl}">Track your package</a></p>`
        : `<p>Tracking details will follow shortly.</p>`
    }
  `;

  await sendEmail({
    to: (order.profiles as any).email,
    subject: `Your order #${order.id} has shipped`,
    html,
  });

  return new Response(JSON.stringify({ sent: true }), { status: 200 });
});

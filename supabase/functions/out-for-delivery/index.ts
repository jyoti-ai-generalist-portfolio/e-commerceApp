// supabase/functions/out-for-delivery/index.ts
//
// Fired by `trg_order_out_for_delivery` when orders.status transitions to
// 'Out for Delivery'. Sends an email via Resend and (optionally) a push/SMS
// notification. Push/SMS provider is not specified in the brief, so that
// call is stubbed behind PUSH_PROVIDER_URL / PUSH_PROVIDER_KEY env vars —
// wire up your provider of choice (e.g. OneSignal, Twilio) there.
//
// Deploy with: supabase functions deploy out-for-delivery

import { sendEmail } from "../_shared/resend.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const { order_id } = await req.json();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, profiles ( email, full_name, id )")
    .eq("id", order_id)
    .single();

  if (error || !order) {
    console.error("out-for-delivery: order lookup failed", error);
    return new Response("Order not found", { status: 404 });
  }

  await sendEmail({
    to: (order.profiles as any).email,
    subject: `Your order #${order.id} is out for delivery`,
    html: `<h2>Almost there!</h2>
           <p>Order <strong>#${order.id}</strong> is out for delivery and
              should arrive today.</p>`,
  });

  // Optional push/SMS notification — stub, wire to your provider.
  const pushUrl = Deno.env.get("PUSH_PROVIDER_URL");
  const pushKey = Deno.env.get("PUSH_PROVIDER_KEY");
  if (pushUrl && pushKey) {
    await fetch(pushUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pushKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: (order.profiles as any).id,
        message: `Your order #${order.id} is arriving today!`,
      }),
    }).catch((err) => console.error("Push notification failed:", err));
  }

  return new Response(JSON.stringify({ sent: true }), { status: 200 });
});

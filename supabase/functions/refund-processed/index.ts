// supabase/functions/refund-processed/index.ts
//
// Fired by `trg_refund_processed` when returns.status transitions to
// 'Refunded'. Refunds are handled OFFLINE per the brief (no Stripe refund
// API call here) — this function restocks inventory and emails the
// customer that the refund was approved.
//
// Deploy with: supabase functions deploy refund-processed

import { sendEmail } from "../_shared/resend.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const { return_id } = await req.json();

  const { data: ret, error } = await supabaseAdmin
    .from("returns")
    .select(
      `id, order_id,
       orders ( id, profiles ( email, full_name ),
                 order_items ( product_id, quantity ) )`
    )
    .eq("id", return_id)
    .single();

  if (error || !ret) {
    console.error("refund-processed: lookup failed", error);
    return new Response("Return not found", { status: 404 });
  }

  const items = (ret.orders as any).order_items as { product_id: string; quantity: number }[];

  // Restock each item and log the change
  for (const item of items) {
    await supabaseAdmin.rpc("increment_stock", {
      p_product_id: item.product_id,
      p_qty: item.quantity,
    });

    await supabaseAdmin.from("inventory_logs").insert({
      product_id: item.product_id,
      change_qty: item.quantity,
      reason: "refund_restock",
      reference_id: ret.id,
    });
  }

  const customer = (ret.orders as any).profiles;
  await sendEmail({
    to: customer.email,
    subject: `Refund approved — order #${(ret.orders as any).id}`,
    html: `<h2>Your refund has been approved</h2>
           <p>The refund for order <strong>#${(ret.orders as any).id}</strong>
              has been processed. Funds should reflect in your original
              payment method within 5-10 business days.</p>`,
  });

  return new Response(JSON.stringify({ refunded: true }), { status: 200 });
});

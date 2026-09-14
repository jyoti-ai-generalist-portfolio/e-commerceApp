// supabase/functions/order-confirmation/index.ts
//
// Fired by the `trg_order_placed` Postgres trigger (see triggers.sql) via
// pg_net whenever a new row is inserted into `orders`.
// Sends an invoice-style confirmation email through Resend.
//
// Deploy with: supabase functions deploy order-confirmation

import { sendEmail } from "../_shared/resend.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const { order_id } = await req.json();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      `id, total_amount, shipping_address, created_at,
       profiles ( email, full_name ),
       order_items ( quantity, price_at_purchase, products ( title ) )`
    )
    .eq("id", order_id)
    .single();

  if (error || !order) {
    console.error("order-confirmation: order lookup failed", error);
    return new Response("Order not found", { status: 404 });
  }

  const itemsHtml = (order.order_items as any[])
    .map(
      (i) =>
        `<tr>
           <td>${i.products.title}</td>
           <td style="text-align:center">${i.quantity}</td>
           <td style="text-align:right">$${i.price_at_purchase}</td>
         </tr>`
    )
    .join("");

  const html = `
    <h2>Thanks for your order, ${(order.profiles as any).full_name ?? "there"}!</h2>
    <p>Order <strong>#${order.id}</strong> placed on
       ${new Date(order.created_at).toLocaleDateString()}</p>
    <table width="100%" cellpadding="6" style="border-collapse:collapse">
      <thead>
        <tr><th align="left">Item</th><th>Qty</th><th align="right">Price</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p><strong>Total: $${order.total_amount}</strong></p>
    <p>We'll email you again once your order ships.</p>
  `;

  await sendEmail({
    to: (order.profiles as any).email,
    subject: `Order Confirmation — #${order.id}`,
    html,
  });

  return new Response(JSON.stringify({ sent: true }), { status: 200 });
});

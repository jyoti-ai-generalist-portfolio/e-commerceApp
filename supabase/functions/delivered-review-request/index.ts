// supabase/functions/delivered-review-request/index.ts
//
// NOT fired by a row-level trigger — "3 days after delivery" is a delay,
// and Postgres triggers can't sleep. Instead this function is invoked once
// a day by pg_cron (see triggers.sql: `review-request-daily` schedule).
// It finds orders marked 'Delivered' exactly 3+ days ago that haven't had
// a review request sent yet, and emails each one.
//
// Requires an extra column: orders.review_email_sent boolean default false
// (see triggers.sql — added there since it's not in the original table
// matrix but is needed to avoid sending duplicate review emails).
//
// Deploy with: supabase functions deploy delivered-review-request

import { sendEmail } from "../_shared/resend.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (_req) => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, updated_at, profiles ( email, full_name )")
    .eq("status", "Delivered")
    .eq("review_email_sent", false)
    .lte("updated_at", threeDaysAgo);

  if (error) {
    console.error("delivered-review-request: query failed", error);
    return new Response("Query failed", { status: 500 });
  }

  let sentCount = 0;
  for (const order of orders ?? []) {
    await sendEmail({
      to: (order.profiles as any).email,
      subject: `How was your order #${order.id}?`,
      html: `<h2>Enjoying your purchase?</h2>
             <p>We'd love a quick review of order <strong>#${order.id}</strong>
                — it helps other customers and takes less than a minute.</p>`,
    });

    await supabaseAdmin
      .from("orders")
      .update({ review_email_sent: true })
      .eq("id", order.id);

    sentCount++;
  }

  return new Response(JSON.stringify({ sent: sentCount }), { status: 200 });
});

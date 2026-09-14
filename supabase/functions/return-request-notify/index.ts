// supabase/functions/return-request-notify/index.ts
//
// Fired by `trg_return_requested` on INSERT into `returns`.
// Flags the store manager — implemented as an email to the admin inbox
// (STORE_ADMIN_EMAIL) plus a row your admin dashboard can subscribe to via
// Supabase Realtime directly on the `returns` table (no extra code needed
// client-side: `supabase.channel('returns').on('postgres_changes', ...)`).
//
// Deploy with: supabase functions deploy return-request-notify

import { sendEmail } from "../_shared/resend.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const { return_id } = await req.json();

  const { data: ret, error } = await supabaseAdmin
    .from("returns")
    .select("id, reason, order_id, orders ( id, customer_id, profiles ( email, full_name ) )")
    .eq("id", return_id)
    .single();

  if (error || !ret) {
    console.error("return-request-notify: lookup failed", error);
    return new Response("Return not found", { status: 404 });
  }

  const adminEmail = Deno.env.get("STORE_ADMIN_EMAIL")!;
  const customer = (ret.orders as any).profiles;

  await sendEmail({
    to: adminEmail,
    subject: `New return request — order #${(ret.orders as any).id}`,
    html: `<h2>Return requested</h2>
           <p>Customer: ${customer.full_name ?? customer.email}</p>
           <p>Order: #${(ret.orders as any).id}</p>
           <p>Reason: ${ret.reason}</p>
           <p>Review it in the admin panel.</p>`,
  });

  return new Response(JSON.stringify({ notified: true }), { status: 200 });
});

// Server-only Resend helper. Never import from a Client Component.
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

//added function below
function assertConfigured() {
  if (!resend) {
    // Fail loudly to the caller (who wraps this in try/catch) rather than
    // silently pretending the email sent.
    throw new Error('RESEND_API_KEY is not configured');
  }
}


export async function sendWelcomeEmail({ to, name }) {
  // called assertConfigured() to check if resend is configured before sending the email
  assertConfigured();

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Store <onboarding@resend.dev>',
    to,
    subject: 'Welcome to Our Store!',
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; color: #14213D;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">Welcome${name ? `, ${name}` : ''}.</h1>
        <p style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
          Your account is set up and ready. Here's how to get started:
        </p>
        <ul style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.8;">
          <li>Browse the catalog and filter by category</li>
          <li>Add items to your cart — it's saved to your account automatically</li>
          <li>Checkout securely whenever you're ready</li>
        </ul>
        <p style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
          Thanks for joining us.
        </p>
      </div>
    `,
  });
}

// addded code below for checkout and payment module
function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

// Called once an order transitions to 'paid' — from either the
// verify-payment route (client came back online in time) or the Razorpay
// webhook (client dropped off, see UC-09 edge case "Network Drop-Off /
// Timeout"). Idempotency (don't send twice) is the caller's
// responsibility — see orders.review_email_sent-style guard pattern used
// elsewhere in this codebase; for order *confirmation* specifically the
// caller should only invoke this the first time submit_payment_and_finalize
// returns status: 'paid' (not on 'already_paid' replays).
export async function sendOrderConfirmationEmail({ to, name, orderId, items, totals }) {
  assertConfigured();

  const rows = (items || [])
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 0; font-family:Arial, sans-serif; font-size:14px;">${i.title}</td>
          <td style="padding:8px 0; font-family:Arial, sans-serif; font-size:14px; text-align:center;">${i.quantity}</td>
          <td style="padding:8px 0; font-family:Arial, sans-serif; font-size:14px; text-align:right;">${formatINR(i.price_at_purchase)}</td>
        </tr>`
    )
    .join('');

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Store <onboarding@resend.dev>',
    to,
    subject: `Order confirmed — #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; color: #14213D;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">Thanks${name ? `, ${name}` : ''} — your order is confirmed.</h1>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color:#6b6b6b;">Order ID: ${orderId}</p>
        <table style="width:100%; border-collapse:collapse; margin:16px 0;">
          <thead>
            <tr style="border-bottom:1px solid #d9d9d9;">
              <th style="text-align:left; font-family:Arial, sans-serif; font-size:12px; color:#6b6b6b; padding-bottom:6px;">Item</th>
              <th style="text-align:center; font-family:Arial, sans-serif; font-size:12px; color:#6b6b6b; padding-bottom:6px;">Qty</th>
              <th style="text-align:right; font-family:Arial, sans-serif; font-size:12px; color:#6b6b6b; padding-bottom:6px;">Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height:1.8; border-top:1px solid #d9d9d9; padding-top:10px;">
          <div style="display:flex; justify-content:space-between;"><span>Subtotal</span><span>${formatINR(totals.subtotal)}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Tax</span><span>${formatINR(totals.tax_amount)}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Shipping</span><span>${totals.shipping_fee > 0 ? formatINR(totals.shipping_fee) : 'FREE'}</span></div>
          <div style="display:flex; justify-content:space-between; font-weight:bold; margin-top:6px;"><span>Total</span><span>${formatINR(totals.total_amount)}</span></div>
        </div>
        <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; margin-top:20px;">
          We'll email you again once your order ships.
        </p>
      </div>
    `,
  });
}
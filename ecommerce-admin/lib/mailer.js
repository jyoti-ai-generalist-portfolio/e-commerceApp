// Nodemailer transactional emails for UC-14 / UC-17.
import nodemailer from 'nodemailer';

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shortId = (id) => String(id).slice(0, 8).toUpperCase();

async function send(to, subject, html) {
  await getTransporter().sendMail({ from: process.env.MAIL_FROM, to, subject, html });
}

// Returns { sent, skipped?, error? } - never throws, so an email problem cannot fail a status update.
export async function sendShippingEmail({ to, name, order, status }) {
  // Shipped / Out for Delivery are already emailed by the existing DB triggers
  // (shipment-dispatched, out-for-delivery Edge Functions). Keep this off unless you disable those triggers.
  // Not using the triggers for sending emails since RESEND is not working. Emails will now be sent through smtp
  
  const overlap = status === 'Shipped' || status === 'Out for Delivery';
  if (overlap && process.env.SEND_TRACKING_EMAILS !== 'true') return { sent: false, skipped: 'handled-by-db-trigger' };
  if (status === 'Processing') return { sent: false, skipped: 'no-email-for-status' };
  if (!to) return { sent: false, skipped: 'no-recipient' };

  const ref = shortId(order.id);
  const hi = `<p>Hi ${esc(name || 'there')},</p>`;
  const templates = {
    Shipped: [`Your order #${ref} has shipped`, `${hi}<p>Your order has been shipped.</p><p><b>Tracking number:</b> ${esc(order.tracking_number)}</p>`],
    'Out for Delivery': [`Your order #${ref} is out for delivery`, `${hi}<p>Your order is out for delivery today.</p><p><b>Tracking reference:</b> ${esc(order.tracking_number)}</p>`],
    Delivered: [`Your order #${ref} was delivered`, `${hi}<p>Your order has been delivered.</p><p>You can request a return or refund within <b>7 days</b> of delivery from your orders page.</p>`],
  };
  const [subject, html] = templates[status] || [];
  if (!subject) return { sent: false, skipped: 'no-template' };
  try {
    await send(to, subject, html);
    return { sent: true };
  } catch (e) {
    console.error('Nodemailer shipping email failed:', e.message);
    return { sent: false, error: e.message };
  }
}

export async function sendRefundEmail({ to, name, order, refundIds }) {
  if (!to) return { sent: false, skipped: 'no-recipient' };
  try {
    await send(
      to,
      `Refund approved for order #${shortId(order.id)}`,
      `<p>Hi ${esc(name || 'there')},</p><p>Your refund of <b>INR ${esc(order.total_amount)}</b> has been approved and sent to your original payment method.</p><p><b>Razorpay refund reference:</b> ${refundIds.map(esc).join(', ')}</p><p>Banks typically take 5-7 working days to show the credit.</p>`
    );
    return { sent: true };
  } catch (e) {
    console.error('Nodemailer refund email failed:', e.message);
    return { sent: false, error: e.message };
  }
}

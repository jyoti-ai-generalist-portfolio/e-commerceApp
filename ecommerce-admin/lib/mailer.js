// Nodemailer transactional emails for UC-14 / UC-17 (SMTP).
import nodemailer from 'nodemailer';

let transporter;

function assertConfigured() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASS) is missing');
  }
}

function getTransporter() {
  assertConfigured();
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

const shortId = (id) => String(id).slice(0, 8).toUpperCase();

async function send(to, subject, html) {
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

// Handles 1. Shipped, 2. Out for Delivery, 3. Delivered
// Returns { sent, skipped?, error? } - never throws, so an email problem cannot fail a status update.
export async function sendShippingEmail({ to, name, order, status }) {
  if (status === 'Processing') return { sent: false, skipped: 'no-email-for-status' };
  if (!to) return { sent: false, skipped: 'no-recipient' };

  const ref = shortId(order.id);
  const hi = `<p>Hi ${esc(name || 'there')},</p>`;
  const trackingLine = order.tracking_number
    ? `<p><b>Tracking number:</b> ${esc(order.tracking_number)}</p>`
    : '';

  const templates = {
    Shipped: [
      `Your order #${ref} has shipped`,
      `${hi}<p>Your order has been shipped.</p>${trackingLine}`,
    ],
    'Out for Delivery': [
      `Your order #${ref} is out for delivery`,
      `${hi}<p>Your order is out for delivery today.</p>${trackingLine}`,
    ],
    Delivered: [
      `Your order #${ref} was delivered`,
      `${hi}<p>Your order has been delivered.</p><p>You can request a return or refund within <b>7 days</b> of delivery from your orders page.</p>`,
    ],
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

// Handles 4. Refund Processed
export async function sendRefundEmail({ to, name, order, refundIds }) {
  if (!to) return { sent: false, skipped: 'no-recipient' };

  const refList = Array.isArray(refundIds) && refundIds.length > 0
    ? `<p><b>Razorpay refund reference:</b> ${refundIds.map(esc).join(', ')}</p>`
    : '';

  try {
    await send(
      to,
      `Refund approved for order #${shortId(order.id)}`,
      `<p>Hi ${esc(name || 'there')},</p>
       <p>Your refund of <b>INR ${esc(order.total_amount)}</b> has been approved and sent to your original payment method.</p>
       ${refList}
       <p>Banks typically take 5-7 working days to show the credit.</p>`
    );
    return { sent: true };
  } catch (e) {
    console.error('Nodemailer refund email failed:', e.message);
    return { sent: false, error: e.message };
  }
}

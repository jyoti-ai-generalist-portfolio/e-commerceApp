// Server-only Nodemailer helper. Never import from a Client Component.
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

export async function sendWelcomeEmail({ to, name }) {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'Welcome to Our Store!',
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; color: #14213D;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">Welcome${name ? `, ${esc(name)}` : ''}.</h1>
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

// Optional: Migrated sendOrderConfirmationEmail from resend.js for consistency
function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export async function sendOrderConfirmationEmail({ to, name, orderId, items, totals }) {
  const mailer = getTransporter();

  const rows = (items || [])
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 0; font-family:Arial, sans-serif; font-size:14px;">${esc(i.title)}</td>
          <td style="padding:8px 0; font-family:Arial, sans-serif; font-size:14px; text-align:center;">${i.quantity}</td>
          <td style="padding:8px 0; font-family:Arial, sans-serif; font-size:14px; text-align:right;">${formatINR(i.price_at_purchase)}</td>
        </tr>`
    )
    .join('');

  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Order confirmed — #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; color: #14213D;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">Thanks${name ? `, ${esc(name)}` : ''} — your order is confirmed.</h1>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color:#6b6b6b;">Order ID: ${esc(orderId)}</p>
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

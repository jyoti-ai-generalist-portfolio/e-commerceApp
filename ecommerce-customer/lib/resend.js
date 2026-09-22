// Server-only Resend helper. Never import from a Client Component.
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

export async function sendWelcomeEmail({ to, name }) {
  if (!resend) {
    // Fail loudly to the caller (who wraps this in try/catch) rather than
    // silently pretending the email sent.
    throw new Error('RESEND_API_KEY is not configured');
  }

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

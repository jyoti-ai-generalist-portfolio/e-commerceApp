// Server-only Razorpay helper. Never import from a Client Component.
import Razorpay from 'razorpay';
import crypto from 'crypto';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

export function getRazorpayClient() {
  if (!razorpay) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured');
  }
  return razorpay;
}
// Verifies a Razorpay WEBHOOK signature. This uses a DIFFERENT secret
// (RAZORPAY_WEBHOOK_SECRET, set in the Razorpay dashboard webhook
// config) than the checkout signature in verifyRazorpaySignature() above,
// which uses RAZORPAY_KEY_SECRET. Do not mix the two up.
export function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  }
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const givenBuf = Buffer.from(signatureHeader || '', 'utf8');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}


// Verifies the HMAC-SHA256 signature Razorpay returns after a successful
// checkout. Must match: razorpay_order_id + "|" + razorpay_payment_id,
// signed with the key secret.
export function verifyRazorpaySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!keySecret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // Constant-time comparison to avoid timing attacks.
  const expectedBuf = Buffer.from(expected, 'utf8');
  const givenBuf = Buffer.from(razorpay_signature || '', 'utf8');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}
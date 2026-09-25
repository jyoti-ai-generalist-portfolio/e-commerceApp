// Server-only Razorpay helper. Never import from a Client Component —
// it reads the API secret and would leak it into the browser bundle.
import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

function assertConfigured() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured on the server');
  }
}

function authHeader() {
  const token = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

// amountInPaise: integer. receipt: your own reference string (we pass the
// db order id so it's traceable from the Razorpay dashboard).
export async function createRazorpayOrder({ amountInPaise, currency = 'INR', receipt, notes }) {
  assertConfigured();

  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      receipt,
      notes,
      payment_capture: 1,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.description || 'Razorpay order creation failed');
  }
  return data; // { id: 'order_...', amount, currency, ... }
}

// Verifies the HMAC-SHA256 signature returned by the Razorpay Checkout
// popup after a successful payment.
// signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  assertConfigured();
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return timingSafeEqualHex(expected, razorpaySignature);
}

// Verifies the X-Razorpay-Signature header on incoming webhook requests.
// rawBody MUST be the exact, unparsed request body string/Buffer.
export function verifyWebhookSignature({ rawBody, signatureHeader }) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured on the server');
  }
  const expected = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return timingSafeEqualHex(expected, signatureHeader);
}

function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// Used by the "Refunds & Cancellations" edge case: user cancels payment,
// or a signature mismatch is detected after money left the customer's
// account. Issues a full refund for a captured payment.
export async function refundPayment({ razorpayPaymentId, amountInPaise, notes }) {
  assertConfigured();
  const res = await fetch(`${RAZORPAY_API_BASE}/payments/${razorpayPaymentId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(amountInPaise ? { amount: amountInPaise, notes } : { notes }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.description || 'Razorpay refund failed');
  }
  return data;
}
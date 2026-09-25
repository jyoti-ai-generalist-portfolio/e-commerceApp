// Shared order-total math. Used on the client (for instant UI feedback as
// quantities change) AND on the server (as the source of truth — the
// server always recomputes rather than trusting a client-sent total).
//
// Config comes from env so it can be tuned without a redeploy of logic:
//   NEXT_PUBLIC_TAX_RATE_PERCENTAGE=18
//   SHIPPING_SLABS_JSON='[{"min_subtotal":0,"max_subtotal":1000,"shipping_fee":100},...]'
// Falls back to the defaults from the UC-05/UC-09 spec if unset.

const DEFAULT_TAX_RATE_PERCENTAGE = 18.0;

const DEFAULT_SHIPPING_SLABS = [
  { min_subtotal: 0, max_subtotal: 1000, shipping_fee: 100.0 },
  { min_subtotal: 1000.01, max_subtotal: 5000, shipping_fee: 50.0 },
  { min_subtotal: 5000.01, max_subtotal: null, shipping_fee: 0.0 },
];

function getTaxRatePercentage() {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TAX_RATE_PERCENTAGE) || null;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_TAX_RATE_PERCENTAGE;
}

function getShippingSlabs() {
  const raw = (typeof process !== 'undefined' && process.env.SHIPPING_SLABS_JSON) || null;
  if (!raw) return DEFAULT_SHIPPING_SLABS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SHIPPING_SLABS;
  } catch {
    return DEFAULT_SHIPPING_SLABS;
  }
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function shippingForSubtotal(subtotal) {
  const slabs = getShippingSlabs();
  const slab = slabs.find(
    (s) => subtotal >= s.min_subtotal && (s.max_subtotal === null || subtotal <= s.max_subtotal)
  );
  return slab ? slab.shipping_fee : slabs[slabs.length - 1].shipping_fee;
}

// items: [{ price, quantity }]
export function computeOrderTotals(items) {
  const subtotal = round2(
    (items || []).reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0)
  );
  const taxRate = getTaxRatePercentage();
  const taxAmount = round2(subtotal * (taxRate / 100));
  const shippingFee = round2(shippingForSubtotal(subtotal));
  const totalAmount = round2(subtotal + taxAmount + shippingFee);

  return {
    subtotal,
    tax_rate_percentage: taxRate,
    tax_amount: taxAmount,
    shipping_fee: shippingFee,
    total_amount: totalAmount,
  };
}

export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}
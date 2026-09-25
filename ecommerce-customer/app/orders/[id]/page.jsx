'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '../../../lib/store/AppProviders';

function formatPrice(price) {
  const value = Number(price);
  if (Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}
// orders status can be 
//
const STATUS_COPY = {
  pending_payment: { label: 'Payment pending', tone: 'text-ink/60' },
  paid: { label: 'Payment confirmed', tone: 'text-[#2f7d4f]' },
  payment_failed: { label: 'Payment failed', tone: 'text-danger' },
};

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { session, authReady } = useApp();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authReady) return;
    if (!session?.access_token) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    async function loadOrder() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/orders/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load order');
        if (!cancelled) setOrder(data.data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(err.message || 'Could not load this order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [id, session, authReady, router]);

  if (!authReady || loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-ink/60">Loading your order…</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-display text-lg text-ink">Order not found</p>
        <p className="mt-1 text-sm text-ink/60">{error || 'This order does not exist or is not yours.'}</p>
      </main>
    );
  }

  const status = STATUS_COPY[order.status] || { label: order.status, tone: 'text-ink/60' };
  const addr = order.shipping_address || {};

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-card border border-line bg-white p-6 sm:p-8">
        <div className="mb-6 text-center">
          {order.status === 'paid' ? (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#2f7d4f]/10 text-2xl text-[#2f7d4f]">
              ✓
            </div>
          ) : order.status === 'payment_failed' ? (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-2xl text-danger">
              ✕
            </div>
          ) : null}
          <h1 className="font-display text-2xl text-ink">
            {order.status === 'paid' ? 'Thank you for your order' : 'Order status'}
          </h1>
          <p className={`mt-1 text-sm font-medium ${status.tone}`}>{status.label}</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-y border-line py-3 text-sm">
          <span className="text-ink/60">Order ID</span>
          <span className="font-mono text-xs text-ink">{order.id}</span>
        </div>

        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">Items</h2>
          <ul className="flex flex-col gap-3">
            {(order.order_items || []).map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  {item.products?.title || 'Product'} <span className="text-ink/50">× {item.quantity}</span>
                </span>
                <span className="text-ink/70">
                  {formatPrice(item.price_at_purchase * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-6 rounded-card bg-accent-soft/40 p-4 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
            Shipping to
          </h2>
          <p className="text-ink">{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}</p>
          <p className="text-ink/70">{addr.city} – {addr.pincode}</p>
          <p className="text-ink/70">{addr.mobilenumber}</p>
        </section>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm font-medium text-ink">Total paid</span>
          <span className="font-display text-lg text-ink">{formatPrice(order.total_amount)}</span>
        </div>

        {order.status === 'payment_failed' && (
          <p className="mt-4 text-center text-xs text-ink/60">
            Your payment didn't go through. No amount was charged for this attempt — you can retry from your cart.
          </p>
        )}
      </div>
    </main>
  );
}
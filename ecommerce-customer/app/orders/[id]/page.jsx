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

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SHIPPING_STATUS_COPY = {
  processing: { label: 'Processing', tone: 'text-ink/60' },
  shipped: { label: 'Shipped', tone: 'text-ink/60' },
  delivered: { label: 'Delivered', tone: 'text-[#2f7d4f]' },
  cancelled: { label: 'Cancelled', tone: 'text-danger' },
  returned: { label: 'Returned', tone: 'text-ink/60' },
};

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { session, authReady } = useApp();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);

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

  async function handleOrderAction(actionType) {
    if (!session?.access_token || submittingAction) return;
    
    const label = actionType === 'CANCEL' ? 'cancellation' : 'return';
    const reason = prompt(`Please enter a reason for your ${label} (at least 5 characters):`);
    
    if (reason === null) return; 
    if (reason.trim().length < 5) {
      alert(`The ${label} reason must be at least 5 characters long.`);
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/v1/orders/${id}/returns`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_type: actionType,
          reason: reason.trim()
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to submit ${label} request`);
      
      alert(actionType === 'CANCEL' ? 'Cancellation request submitted successfully!' : 'Return request submitted successfully!');
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not process your request at this time.');
    } finally {
      setSubmittingAction(false);
    }
  }

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

  const currentShippingStatus = order.order_shipping_status?.toLowerCase() || '';
  const statusCopy = SHIPPING_STATUS_COPY[currentShippingStatus] || { 
    label: order.order_shipping_status || 'Processing', 
    tone: 'text-ink/60' 
  };
  const addr = order.shipping_address || {};

  const hasExistingRequest = order.returns && order.returns.length > 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-card border border-line bg-white p-6 sm:p-8">
        <div className="mb-6 text-center">
          {['delivered', 'shipped', 'processing'].includes(currentShippingStatus) ? (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#2f7d4f]/10 text-2xl text-[#2f7d4f]">
              ✓
            </div>
          ) : currentShippingStatus === 'cancelled' || order.status?.toLowerCase() === 'payment_failed' ? (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-2xl text-danger">
              ✕
            </div>
          ) : null}
          <h1 className="font-display text-2xl text-ink">
            {currentShippingStatus === 'delivered' ? 'Order delivered' : 'Order status'}
          </h1>
          <p className={`mt-1 text-sm font-medium ${statusCopy.tone}`}>{statusCopy.label}</p>
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
                  {item.title} <span className="text-ink/50">× {item.quantity}</span>
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

        {!hasExistingRequest && order.status?.toLowerCase() === 'paid' && (
          <div className="mt-6 border-t border-line pt-4 text-center">
            {currentShippingStatus === 'delivered' ? (
              <button
                onClick={() => handleOrderAction('RETURN')}
                disabled={submittingAction}
                className="w-full rounded-md bg-neutral-100 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
              >
                {submittingAction ? 'Submitting Return...' : 'Return Order'}
              </button>
            ) : ['processing', 'shipped'].includes(currentShippingStatus) ? (
              <button
                onClick={() => handleOrderAction('CANCEL')}
                disabled={submittingAction}
                className="w-full rounded-md bg-danger/10 py-2.5 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-50"
              >
                {submittingAction ? 'Submitting Cancellation...' : 'Cancel Order'}
              </button>
            ) : null}
          </div>
        )}

        {hasExistingRequest && (
          <section className="mt-8 border-t border-line pt-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink/50">
              Return & Cancellation History
            </h2>
            <div className="flex flex-col gap-4">
              {order.returns.map((req) => {
                const isCancel = req.reason?.startsWith('CANCEL:');
                const isReturn = req.reason?.startsWith('RETURN:');
                
                let cleanReason = req.reason || '';
                let requestLabel = 'Request';
                
                if (isCancel) {
                  cleanReason = req.reason.replace('CANCEL:', '');
                  requestLabel = 'Cancellation Request';
                } else if (isReturn) {
                  cleanReason = req.reason.replace('RETURN:', '');
                  requestLabel = 'Return Request';
                }

                return (
                  <div key={req.id} className="rounded-card border border-line bg-neutral-50/50 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="font-medium text-ink">{requestLabel}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        req.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        req.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status || 'Requested'}
                      </span>
                    </div>
                    <p className="text-ink/80 mb-1">
                      Reason: "{cleanReason}"
                    </p>
                    <p className="text-xs text-ink/50">
                      Submitted on {formatDate(req.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {order.status?.toLowerCase() === 'payment_failed' && (
          <div className="mt-6 rounded-card bg-danger/10 p-4 text-sm text-danger text-center">
            Your payment didn't go through. No amount was charged for this attempt — you can retry from your cart.
          </div>
        )}
      </div>
    </main>
  );
}


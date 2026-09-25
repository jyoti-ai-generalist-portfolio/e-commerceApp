'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '../lib/store/AppProviders';

function formatPrice(price) {
  const value = Number(price);
  if (Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const STATUS_FILTERS = [
  { value: '', label: 'All orders' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending_payment', label: 'Pending' },
  { value: 'payment_failed', label: 'Failed' },
];

const STATUS_BADGE = {
  paid: 'border-[#2f7d4f]/30 bg-[#2f7d4f]/10 text-[#2f7d4f]',
  pending_payment: 'border-line bg-accent-soft/50 text-ink/60',
  payment_failed: 'border-danger/30 bg-danger/10 text-danger',
};

export default function MyOrdersPage() {
  const { session, authReady } = useApp();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const requestSeq = useRef(0);

  const loadOrders = useCallback(
    async (targetPage, status) => {
      if (!session?.access_token) return;
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(targetPage), limit: '10' });
        if (status) params.set('status', status);

        const res = await fetch(`/api/v1/orders?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load orders');
        if (seq !== requestSeq.current) return;

        setOrders(data.data || []);
        setTotalPages(data.total_pages || 1);
        setTotalItems(data.total_items || 0);
      } catch (err) {
        console.error(err);
        if (seq === requestSeq.current) {
          setError(err.message || 'Could not load your orders');
          setOrders([]);
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    if (!authReady) return;
    if (!session?.access_token) {
      router.replace('/');
      return;
    }
    loadOrders(page, statusFilter);
  }, [authReady, session, page, statusFilter, loadOrders]);

  function applyStatusFilter(next) {
    if (next === statusFilter) return;
    setStatusFilter(next);
    setPage(1);
  }

  if (!authReady) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-sm text-ink/60">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 font-display text-2xl text-ink">My orders</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => applyStatusFilter(f.value)}
            className={`min-h-[36px] rounded-full border px-4 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'border-ink bg-ink text-paper'
                : 'border-line bg-white text-ink hover:border-accent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-ink/60">Loading your orders…</p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-danger">{error}</p>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-display text-lg text-ink">No orders yet</p>
          <p className="mt-1 text-sm text-ink/60">Orders you place will show up here.</p>
          <Link
            href="/"
            className="mt-4 inline-block min-h-[44px] rounded-card border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-accent"
          >
            Browse the catalog
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {orders.map((order) => {
              const itemCount = (order.order_items || []).reduce((s, i) => s + i.quantity, 0);
              const previewTitle = order.order_items?.[0]?.products?.title;
              const extraCount = (order.order_items?.length || 0) - 1;
              const badgeClass = STATUS_BADGE[order.status] || 'border-line bg-accent-soft/50 text-ink/60';

              return (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex flex-col gap-3 rounded-card border border-line bg-white p-4 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-ink/50">
                          #{order.id.slice(0, 8)}
                        </span>
                        <span className={`rounded-card border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-ink">
                        {previewTitle}
                        {extraCount > 0 ? ` + ${extraCount} more item${extraCount > 1 ? 's' : ''}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-ink/50">
                        {formatDate(order.created_at)} · {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="font-display text-base text-ink">
                        {formatPrice(order.total_amount)}
                      </span>
                      <span className="text-ink/40">›</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-[44px] rounded-card border border-line px-4 text-sm font-medium text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹ Previous
              </button>
              <span className="text-sm text-ink/70">
                Page {page} of {totalPages} · {totalItems} orders
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-[44px] rounded-card border border-line px-4 text-sm font-medium text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next ›
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
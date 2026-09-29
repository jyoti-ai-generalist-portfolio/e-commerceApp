'use client';
// /admin/orders - Active Orders View (UC-14)
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// CONFIRM: same import paths/props the dashboard page uses for the shell (remove if a layout already renders them)
import AdminSidebar from '@/components/AdminSidebar';
import AdminTopBar from '@/components/AdminTopBar';

const STATUSES = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

export default function AdminOrdersPage() {
  const router = useRouter();
  const [data, setData] = useState({ orders: [], page: 1, pageSize: 10, total: 0 });
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState({}); // { [orderId]: { status, tracking } }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  const notify = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 5000); };

  const load = useCallback(async (p) => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/v1/admin/orders?page=${p}`, { cache: 'no-store' });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load orders');
      setData(json);
      setEdits(Object.fromEntries(json.orders.map((o) => [o.id, { status: o.order_shipping_status, tracking: o.tracking_number || '' }])));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [router]);

  useEffect(() => { load(page); }, [page, load]);

  const setEdit = (id, patch) => setEdits((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  async function save(order) {
    const e = edits[order.id];
    if (e.status === 'Shipped' && !e.tracking.trim()) { notify('error', 'Enter a tracking number to mark as Shipped.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${order.id}/shipping-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_shipping_status: e.status, tracking_number: e.tracking.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      const m = json.email || {};
      const mail = m.sent ? 'Email sent to customer.' : m.error ? `Email failed: ${m.error}` : 'No email sent for this status.';
      notify(m.error ? 'warn' : 'ok', `Order updated to ${e.status}. ${mail}`);
      await load(page);
    } catch (err) { notify('error', err.message); setBusy(false); }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <AdminTopBar />
        <main style={{ padding: 24, position: 'relative' }}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Orders &amp; operations</h1>
          <p style={{ color: '#666', marginBottom: 16 }}>Paid orders that are not yet delivered, newest first.</p>

          {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
          {!error && !busy && data.orders.length === 0 && <p>No active orders right now.</p>}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Total</th>
                  <th style={th}>Placed</th><th style={th}>Shipping status</th><th style={th}>Tracking number</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => {
                  const e = edits[o.id] || { status: o.order_shipping_status, tracking: '' };
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={td}>#{o.id.slice(0, 8)}</td>
                      <td style={td}>{o.customer?.full_name || '-'}<br /><small style={{ color: '#666' }}>{o.customer?.email}</small></td>
                      <td style={td}>{inr(o.total_amount)}</td>
                      <td style={td}>{new Date(o.created_at).toLocaleString('en-IN')}</td>
                      <td style={td}>
                        <select value={e.status} onChange={(ev) => setEdit(o.id, { status: ev.target.value })} disabled={busy} aria-label={`Shipping status for order ${o.id.slice(0, 8)}`}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <input value={e.tracking} onChange={(ev) => setEdit(o.id, { tracking: ev.target.value })} disabled={busy} maxLength={100}
                          placeholder={e.status === 'Shipped' ? 'Required' : 'Optional'} aria-label="Tracking number" />
                      </td>
                      <td style={td}><button onClick={() => save(o)} disabled={busy}>Save</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button onClick={() => setPage((p) => p - 1)} disabled={busy || page <= 1}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={busy || page >= pages}>Next</button>
          </div>

          {busy && <Overlay />}
          {toast && <Toast {...toast} />}
        </main>
      </div>
    </div>
  );
}

const th = { padding: '8px 10px' };
const td = { padding: '10px', verticalAlign: 'top' };

function Overlay() {
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,.6)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div style={{ width: 36, height: 36, border: '4px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'uc-spin .8s linear infinite' }} />
      <style>{'@keyframes uc-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
function Toast({ type, text }) {
  const bg = type === 'ok' ? '#e6f4ea' : type === 'warn' ? '#fff4e5' : '#fdecea';
  return <div role="status" style={{ position: 'fixed', right: 24, bottom: 24, background: bg, border: '1px solid #ccc', padding: '12px 16px', borderRadius: 6, zIndex: 60, maxWidth: 360 }}>{text}</div>;
}

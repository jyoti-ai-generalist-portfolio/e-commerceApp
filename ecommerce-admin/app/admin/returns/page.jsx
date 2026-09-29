'use client';
// /admin/returns - Returns & Refunds Processing (UC-17)
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// CONFIRM: same import paths/props the dashboard page uses for the shell (remove if a layout already renders them)
import AdminSidebar from '@/components/AdminSidebar';
import AdminTopBar from '@/components/AdminTopBar';

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

export default function AdminReturnsPage() {
  const router = useRouter();
  const [data, setData] = useState({ returns: [], page: 1, pageSize: 10, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('Requested');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  const notify = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 6000); };

  const load = useCallback(async (p, s) => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/v1/admin/returns?page=${p}${s ? `&status=${s}` : ''}`, { cache: 'no-store' });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load requests');
      setData(json);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [router]);

  useEffect(() => { load(page, status); }, [page, status, load]);

  async function approve(r) {
    if (!window.confirm(`Refund ${inr(r.orders?.total_amount)} to the customer and restore stock? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/returns/${r.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: r.order_id, return_id: r.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Refund failed');
      const m = json.email || {};
      notify(m.error ? 'warn' : 'ok', `Refund approved (${json.refund_ids.join(', ')}). ${m.sent ? 'Email sent to customer.' : `Email not sent${m.error ? `: ${m.error}` : '.'}`}`);
      await load(page, status);
    } catch (e) { notify('error', e.message); setBusy(false); }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <AdminTopBar />
        <main style={{ padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Returns &amp; refunds</h1>
          <label style={{ display: 'inline-block', margin: '8px 0 16px' }}>
            Show{' '}
            <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} disabled={busy}>
              <option value="Requested">Awaiting decision</option>
              <option value="Approved">Approved</option>
              <option value="">All</option>
            </select>
          </label>

          {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
          {!error && !busy && data.returns.length === 0 && <p>No requests to show.</p>}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th style={th}>Type</th><th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Amount</th>
                  <th style={th}>Reason</th><th style={th}>Requested</th><th style={th}>Status</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {data.returns.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={td}>{r.kind}</td>
                    <td style={td}>#{r.order_id.slice(0, 8)}</td>
                    <td style={td}>{r.customer?.full_name || '-'}<br /><small style={{ color: '#666' }}>{r.customer?.email}</small></td>
                    <td style={td}>{inr(r.orders?.total_amount)}</td>
                    <td style={{ ...td, maxWidth: 260 }}>{r.reason}</td>
                    <td style={td}>{new Date(r.created_at).toLocaleString('en-IN')}</td>
                    <td style={td}>{r.status}</td>
                    <td style={td}><button onClick={() => approve(r)} disabled={busy || r.status !== 'Requested'}>Approve Refund</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button onClick={() => setPage((p) => p - 1)} disabled={busy || page <= 1}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={busy || page >= pages}>Next</button>
          </div>

          {busy && (
            <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,.6)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
              <div style={{ width: 36, height: 36, border: '4px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'uc-spin .8s linear infinite' }} />
              <style>{'@keyframes uc-spin{to{transform:rotate(360deg)}}'}</style>
            </div>
          )}
          {toast && (
            <div role="status" style={{ position: 'fixed', right: 24, bottom: 24, background: toast.type === 'ok' ? '#e6f4ea' : toast.type === 'warn' ? '#fff4e5' : '#fdecea', border: '1px solid #ccc', padding: '12px 16px', borderRadius: 6, zIndex: 60, maxWidth: 380 }}>{toast.text}</div>
          )}
        </main>
      </div>
    </div>
  );
}

const th = { padding: '8px 10px' };
const td = { padding: '10px', verticalAlign: 'top' };

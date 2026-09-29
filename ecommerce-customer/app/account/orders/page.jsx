'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../components/orders/orders.module.css';
import OrderCard from '../../../components/orders/OrderCard';
import RequestModal from '../../../components/orders/RequestModal';
import { authFetch } from '../../../lib/authFetch';

const PAGE_SIZE = 10;

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { order, type }
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`/api/v1/customer/orders?page=${page}&limit=${PAGE_SIZE}`);
      if (res.status === 401) { router.replace('/'); return; } // same behaviour as checkout
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load orders.');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function handleDone(request, refreshOnly) {
    setModal(null);
    if (request) setToast('Request submitted. We will email you once it is reviewed.');
    if (request || refreshOnly) load();
  }

  return (
    <main className={styles.wrap}>
      <h1 className={styles.h1}>My Orders</h1>
      {error && <div className={`${styles.banner} ${styles.bannerErr}`}>{error} <button className={styles.link} onClick={load}>Retry</button></div>}

      {loading && !data && [1, 2, 3].map((n) => <div key={n} className={styles.skel} />)}
      {data && data.orders.length === 0 && <p className={styles.muted}>You have not placed any orders yet.</p>}
      {data && data.orders.map((o) => (
        <OrderCard key={o.id} order={o} linkToDetail onRequest={(order, type) => setModal({ order, type })} />
      ))}

      {data && data.totalPages > 1 && (
        <div className={styles.pager}>
          <button className={styles.btn} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className={styles.muted}>Page {data.page} of {data.totalPages}</span>
          <button className={styles.btn} disabled={page >= data.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {modal && <RequestModal order={modal.order} type={modal.type} onClose={() => setModal(null)} onDone={handleDone} />}
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </main>
  );
}

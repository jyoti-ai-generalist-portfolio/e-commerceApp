'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import styles from '../../../../components/orders/orders.module.css';
import OrderCard from '../../../../components/orders/OrderCard';
import RequestModal from '../../../../components/orders/RequestModal';
import { authFetch } from '../../../../lib/authFetch';

export default function CustomerOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 🛠️ FIX 1: Dropped the "/customer" segment from the endpoint path string
      const res = await authFetch(`/api/v1/orders/${id}`);
     
      if (res.status === 401) { router.replace('/'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load this order.');
       
      // 🛠️ FIX 2: Updated key lookup target from json.order to json.data
      setOrder(json.data);
      
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <main className={styles.wrap}>
      <Link href="/account/orders" className={styles.link}>&larr; All orders</Link>
      <h1 className={styles.h1}>Order details</h1>
      {error && <div className={`${styles.banner} ${styles.bannerErr}`}>{error}</div>}
      {loading && !order && <div className={styles.skel} />}
      {order && <OrderCard order={order} defaultOpen onRequest={(o, type) => setModal({ order: o, type })} />}
      {modal && (
        <RequestModal
          order={modal.order}
          type={modal.type}
          onClose={() => setModal(null)}
          onDone={(req, refresh) => {
            setModal(null);
            if (req) setToast('Request submitted. We will email you once it is reviewed.');
            if (req || refresh) load();
          }}
        />
      )}
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </main>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import styles from './orders.module.css';
import {
  canCancel, canReturn, isReturnWindowExpired, getRequestType, stripPrefix, RETURN_WINDOW_DAYS,
} from '../../lib/orderRules';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const PAY_LABEL = {
  paid: 'Paid', pending_payment: 'Payment pending', payment_failed: 'Payment failed', payment_refunded: 'Refunded',
};
const payClass = (s) => (s === 'paid' ? styles.ok : s === 'pending_payment' ? styles.warn : s === 'payment_failed' ? styles.bad : '');
const shipClass = (s) => (s === 'Delivered' ? styles.ok : s === 'Cancelled' ? styles.bad : '');

export default function OrderCard({ order, onRequest, defaultOpen = false, linkToDetail = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const latest = order.returns?.[0];
  const showExpired = isReturnWindowExpired(order) && !latest;

  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <div>
          <strong>Order #{order.id.slice(0, 8).toUpperCase()}</strong>
          <div className={styles.muted}>{fmtDate(order.created_at)}</div>
        </div>
        <div className={styles.total}>{inr.format(Number(order.total_amount))}</div>
      </div>

      <div className={styles.badges}>
        <span className={`${styles.badge} ${payClass(order.status)}`}>{PAY_LABEL[order.status] || order.status}</span>
        <span className={`${styles.badge} ${shipClass(order.order_shipping_status)}`}>{order.order_shipping_status}</span>
        {order.tracking_number && <span className={styles.badge}>Tracking: {order.tracking_number}</span>}
        {order.delivery_date && <span className={styles.badge}>Delivered {fmtDate(order.delivery_date)}</span>}
      </div>

      {latest && (
        <div className={`${styles.banner} ${latest.status === 'Rejected' ? styles.bannerErr : styles.bannerWarn}`}>
          {getRequestType(latest.reason) === 'CANCEL' ? 'Cancellation' : 'Return'} request: <strong>{latest.status}</strong>
          {' '}- {stripPrefix(latest.reason)}
        </div>
      )}
      {showExpired && (
        <div className={`${styles.banner} ${styles.bannerWarn}`}>
          The {RETURN_WINDOW_DAYS}-day return window for this order has closed.
        </div>
      )}

      <button className={styles.link} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Hide items' : `View items (${order.order_items.length})`}
      </button>
      {open && (
        <div className={styles.items}>
          {order.order_items.map((i) => (
            <div key={i.id} className={styles.item}>
              {/* 🛠️ FIX: Data extraction updated from i.title to match your query schema nesting (i.products?.title) */}
               <span>{i.products?.title || 'Product'} x {i.quantity}</span>
              
              <span>{inr.format(Number(i.price_at_purchase) * i.quantity)}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        {canCancel(order) && (
          <button className={`${styles.btn} ${styles.danger}`} onClick={() => onRequest(order, 'CANCEL')}>Cancel Order</button>
        )}
        {canReturn(order) && (
          <button className={styles.btn} onClick={() => onRequest(order, 'RETURN')}>Request Return</button>
        )}
        {linkToDetail && (
          <Link className={styles.btn} href={`/account/orders/${order.id}`}>View details</Link>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import styles from './orders.module.css';
import { authFetch } from '../../lib/authFetch';

const MIN = 5;
const MAX = 500;

export default function RequestModal({ order, type, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState('');

  const trimmed = reason.trim();
  const fieldError =
    trimmed.length === 0 ? 'Reason is required.'
    : trimmed.length < MIN ? `Please enter at least ${MIN} characters.`
    : trimmed.length > MAX ? `Reason must be ${MAX} characters or fewer.`
    : '';
  const label = type === 'CANCEL' ? 'Cancel order' : 'Request return';

  async function submit() {
    setTouched(true);
    if (fieldError) return;
    setBusy(true);
    setApiError('');
    try {
      // 🛠️ FIX 1: Removed the "/customer" segment from the active network endpoint
      const res = await authFetch(`/api/v1/orders/${order.id}/returns`, {
        method: 'POST',
        body: JSON.stringify({ request_type: type, reason: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiError(json.error || 'Request failed. Please try again.');
        if (json.code === 'WINDOW_EXPIRED' || json.code === 'DUPLICATE_REQUEST') onDone?.(null, true);
        return;
      }
      onDone?.(json.request, false);
    } catch {
      setApiError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px' }}>{label}</h2>
        <p className={styles.muted}>Order #{order.id.slice(0, 8).toUpperCase()}</p>
        <label htmlFor="reason" style={{ display: 'block', margin: '12px 0 4px', fontWeight: 600 }}>
          Reason *
        </label>
        <textarea
          id="reason"
          className={styles.ta}
          value={reason}
          maxLength={MAX + 50}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={type === 'CANCEL' ? 'Why do you want to cancel?' : 'e.g. Defective item received'}
        />
        {touched && fieldError && <div className={styles.fieldErr}>{fieldError}</div>}
        <div className={styles.muted}>{trimmed.length}/{MAX}</div>
        {apiError && <div className={`${styles.banner} ${styles.bannerErr}`}>{apiError}</div>}
        <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
          <button className={styles.btn} onClick={onClose} disabled={busy}>Close</button>
          <button className={`${styles.btn} ${styles.primary}`} onClick={submit} disabled={busy}>
            {busy ? 'Submitting...' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  );
}

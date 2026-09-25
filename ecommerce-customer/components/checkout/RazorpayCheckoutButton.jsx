// components/checkout/RazorpayCheckoutButton.jsx

'use client';

import { useState, useCallback } from 'react';
import { useApp } from '../../lib/store/AppProviders';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.body.appendChild(script);
  });
}

export default function RazorpayCheckoutButton({ disabled, shippingAddress, amount, accessToken }) {
  const { pushToast, user } = useApp();
  const [processing, setProcessing] = useState(false);

  const handlePay = useCallback(async () => {
    if (!accessToken) {
      pushToast('Please log in to complete checkout.', 'error');
      return;
    }
    setProcessing(true);
    try {
      await loadRazorpayScript();

      // 1. Create draft order + Razorpay order (server re-prices from DB).
      const createRes = await fetch('/api/v1/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ shipping_address: shippingAddress }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData?.error || 'Could not start checkout');

      // 2. Open the Razorpay modal.
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: createData.amount,
        currency: createData.currency,
        name: 'Store',
        description: 'Order payment',
        order_id: createData.razorpay_order_id,
        prefill: {
          name: user?.user_metadata?.full_name || '',
          email: user?.email || '',
        },
        handler: async (response) => {
          // 3. Verify signature server-side.
          try {
            const verifyRes = await fetch('/api/v1/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                order_id: createData.order_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData?.error || 'Payment verification failed');

            pushToast('Payment successful! Your order is confirmed.');
            window.location.href = `/orders/${createData.order_id}`;
          } catch (err) {
            console.error(err);
            pushToast('Payment was processed but verification failed. Contact support.', 'error');
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            pushToast('Payment cancelled.', 'error');
          },
        },
        theme: { color: '#1a1a1a' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        console.error('Razorpay payment.failed', resp.error);
        pushToast('Payment failed. Please try another method.', 'error');
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      pushToast(err.message || 'Could not start payment', 'error');
      setProcessing(false);
    }
  }, [accessToken, shippingAddress, user, pushToast]);

  return (
    <button
      type="button"
      disabled={disabled || processing}
      onClick={handlePay}
      className="min-h-[44px] w-full rounded-card bg-ink text-sm font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {processing ? 'Processing…' : `Pay ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0)}`}
    </button>
  );
}
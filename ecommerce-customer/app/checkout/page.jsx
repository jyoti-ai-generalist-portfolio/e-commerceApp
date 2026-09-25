'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
//import { useApp } from '../lib/store/AppProviders';
import { useApp } from '../../lib/store/AppProviders';
import AddressSelector from '../../components/checkout/AddressSelector';
import RazorpayCheckoutButton from '../../components/checkout/RazorpayCheckoutButton';
import { buildShippingAddressPayload } from '../../lib/checkoutStore';

function formatPrice(price) {
  const value = Number(price);
  if (Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

const TAX_RATE = 0.18;
const FREE_SHIPPING_THRESHOLD = 5000;
const SHIPPING_FLAT_FEE = 99;

export default function CheckoutPage() {
  const { cartItems, cartLoading, session, authReady, isLoggedIn } = useApp();
  const router = useRouter();

  const [selectedAddress, setSelectedAddress] = useState(null);

  // Checkout requires a logged-in session — guest carts have nowhere to
  // attach an order (orders.customer_id is not nullable per schema).
  useEffect(() => {
    if (!authReady) return;
    if (!isLoggedIn) {
      router.replace('/');
    }
  }, [authReady, isLoggedIn, router]);

  if (!authReady || (!isLoggedIn && authReady)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-sm text-ink/60">Loading…</p>
      </main>
    );
  }

  const subtotal = cartItems.reduce((sum, i) => sum + i.quantity * Number(i.price || 0), 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_FEE;
  const total = subtotal + tax + shipping;

  if (!cartLoading && cartItems.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-display text-lg text-ink">Your cart is empty</p>
        <p className="mt-1 text-sm text-ink/60">Add something from the catalog before checking out.</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-4 inline-block min-h-[44px] rounded-card border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-accent"
        >
          Browse the catalog
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <h1 className="mb-8 font-display text-2xl text-ink sm:text-3xl">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left column: address + cart review */}
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ink text-xs">
                1
              </span>
              Shipping address
            </h2>
            <AddressSelector onSelect={setSelectedAddress} />
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ink text-xs">
                2
              </span>
              Review cart items
            </h2>

            {cartLoading ? (
              <p className="text-sm text-ink/60">Loading your cart…</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {cartItems.map((item) => (
                  <li
                    key={item.product_id}
                    className="flex items-center gap-4 rounded-card border border-line bg-white p-4"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-card bg-accent-soft">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                      <p className="text-xs text-ink/60">
                        {formatPrice(item.price)} each · Qty {item.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-ink">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column: order summary + payment, sticky on desktop */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/60">
              Order summary
            </h2>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-ink/70">
                <span>Items subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink/70">
                <span>Taxes (18% GST)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/70">
                  Shipping {subtotal >= FREE_SHIPPING_THRESHOLD ? `(orders over ${formatPrice(FREE_SHIPPING_THRESHOLD)})` : ''}
                </span>
                <span className={shipping === 0 ? 'font-medium text-[#2f7d4f]' : 'text-ink/70'}>
                  {shipping === 0 ? 'Free' : formatPrice(shipping)}
                </span>
              </div>
            </div>

            <div className="my-4 border-t border-line" />

            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Total payable</span>
              <span className="font-display text-xl text-ink">{formatPrice(total)}</span>
            </div>

            <RazorpayCheckoutButton
              disabled={!selectedAddress || cartItems.length === 0 || cartLoading}
              shippingAddress={buildShippingAddressPayload(selectedAddress)}
              amount={total}
              accessToken={session?.access_token}
            />

            {!selectedAddress && (
              <p className="mt-2 text-center text-[11px] text-ink/40">
                Select a shipping address to continue.
              </p>
            )}
            <p className="mt-2 text-center text-[11px] text-ink/40">Secured by Razorpay</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
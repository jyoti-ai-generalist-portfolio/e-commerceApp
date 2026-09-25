'use client';

import { useApp } from '../lib/store/AppProviders';
import { useRouter } from 'next/navigation';

function formatPrice(price) {
  const value = Number(price);
  if (Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}


export default function CartDrawer() {
  const router = useRouter(); // 2. Initialize the router here
  const { isCartOpen, closeCart, cartItems, cartLoading, setItemQuantity, removeItem, isLoggedIn } =
    useApp();

  if (!isCartOpen) return null;

  const total = cartItems.reduce((sum, i) => sum + i.quantity * Number(i.price || 0), 0);

  // New function handleCheckout added
  function handleCheckout() {
    closeCart();
    router.push('/checkout');
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="relative flex h-full w-full flex-col bg-paper shadow-xl sm:h-full sm:w-96">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl text-ink">Your cart</h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-accent-soft"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!isLoggedIn && (
            <p className="mb-4 rounded-card bg-accent-soft px-3 py-2 text-xs text-ink/70">
              Browsing as a guest — this cart clears if you close the tab. Log in to keep it.
            </p>
          )}

          {cartLoading ? (
            <p className="text-sm text-ink/60">Loading your cart…</p>
          ) : cartItems.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-lg text-ink">Your cart is empty</p>
              <p className="mt-1 text-sm text-ink/60">Add something from the catalog to see it here.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {cartItems.map((item) => (
                <li key={item.product_id} className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-card bg-accent-soft">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-ink/60">
                      {formatPrice(item.price)} · {formatPrice(item.price * item.quantity)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          item.quantity <= 1
                            ? removeItem(item)
                            : setItemQuantity(item, item.quantity - 1)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-card border border-line text-ink hover:border-accent"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setItemQuantity(item, item.quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-card border border-line text-ink hover:border-accent"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="ml-auto text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
          
        <div className="border-t border-line px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm font-medium text-ink">
            <span>Total</span>
            <span className="font-display text-lg">{formatPrice(total)}</span>
          </div>
          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={handleCheckout}
            className="min-h-[44px] w-full rounded-card bg-ink text-sm font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Proceed to checkout
          </button>
          <p className="mt-2 text-center text-[11px] text-ink/40">
            Stock is confirmed at checkout, not before.
          </p>
        </div>
      </div>
    </div>
  );
}

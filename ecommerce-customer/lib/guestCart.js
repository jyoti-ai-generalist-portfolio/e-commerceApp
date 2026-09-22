// Guest (non-logged-in) cart lives strictly in sessionStorage — cleared
// when the tab/page closes, per the spec's guest cart rules.
const STORAGE_KEY = 'guest_cart_v1';

// Shape: { [product_id]: { quantity, title, price, image_url } }
export function readGuestCart() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeGuestCart(cartMap) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cartMap));
}

export function clearGuestCart() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function guestCartTotalCount(cartMap) {
  return Object.values(cartMap || {}).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

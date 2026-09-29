// Shared by the API (authoritative) and the UI (button visibility only).
export const RETURN_WINDOW_DAYS = 7;
export const REQUEST_PREFIX = { CANCEL: '[CANCEL] ', RETURN: '[RETURN] ' };
// A 'Rejected' request does not block a new one.
export const ACTIVE_RETURN_STATUSES = ['Requested', 'Approved', 'Refunded'];

export function hasActiveRequest(order) {
  return (order.returns || []).some((r) => ACTIVE_RETURN_STATUSES.includes(r.status));
}

export function isReturnWindowOpen(order, now = Date.now()) {
  if (!order.delivery_date) return false;
  const elapsed = now - new Date(order.delivery_date).getTime();
  return elapsed >= 0 && elapsed <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function canCancel(order) {
  return (
    order.status === 'paid' &&
    order.order_shipping_status !== 'Delivered' &&
    order.order_shipping_status !== 'Cancelled' &&
    !hasActiveRequest(order)
  );
}

export function canReturn(order, now = Date.now()) {
  return (
    order.status === 'paid' &&
    order.order_shipping_status === 'Delivered' &&
    isReturnWindowOpen(order, now) &&
    !hasActiveRequest(order)
  );
}

export function isReturnWindowExpired(order, now = Date.now()) {
  return (
    order.status === 'paid' &&
    order.order_shipping_status === 'Delivered' &&
    !!order.delivery_date &&
    !isReturnWindowOpen(order, now)
  );
}

export function getRequestType(reason = '') {
  return reason.startsWith(REQUEST_PREFIX.CANCEL) ? 'CANCEL' : 'RETURN';
}

export function stripPrefix(reason = '') {
  return reason.replace(/^\[(CANCEL|RETURN)\]\s*/, '');
}

// app/admin/catalog/components/StockAdjuster.jsx
//
// Quick inline stock counter for a product table row. Sends a signed
// delta (not an absolute value) to the atomic /admin-catalog-stock
// endpoint — see the DEVIATION note in that edge function for why.

import { useState } from "react";

export default function StockAdjuster({ product, onAdjust }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function apply(delta) {
    setBusy(true);
    setError(null);
    try {
      await onAdjust(product.id, delta);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isLow = product.stock_quantity <= product.low_stock_threshold;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || product.stock_quantity <= 0}
          onClick={() => apply(-1)}
          className="h-6 w-6 rounded border border-gray-300 text-sm leading-none disabled:opacity-40"
        >
          −
        </button>
        <span
          className={`min-w-[2.5rem] text-center text-sm font-medium ${
            isLow ? "text-red-600" : "text-gray-900"
          }`}
        >
          {product.stock_quantity}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => apply(1)}
          className="h-6 w-6 rounded border border-gray-300 text-sm leading-none disabled:opacity-40"
        >
          +
        </button>
      </div>
      {isLow && <span className="text-xs text-red-600">Low stock (≤ {product.low_stock_threshold})</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

'use client';

import { useApp } from '../lib/store/AppProviders';

function formatPrice(price) {
  const value = Number(price);
  if (Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export default function ProductCard({ product }) {
  const { addToCart } = useApp();
  const image = product.image_urls?.[0];

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-white">
      <div className="aspect-square w-full bg-accent-soft">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-ink/40">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{product.title}</h3>
        <p className="font-display text-lg text-ink">{formatPrice(product.price)}</p>
        <button
          type="button"
          onClick={() => addToCart(product, 1)}
          className="mt-auto min-h-[44px] rounded-card bg-ink text-sm font-medium text-paper transition-colors hover:bg-accent"
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}

'use client';

import ProductCard from './ProductCard';

export default function ProductGrid({ products, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-card border border-line bg-white">
            <div className="aspect-square w-full bg-accent-soft/60" />
            <div className="space-y-2 p-4">
              <div className="h-3.5 w-3/4 rounded bg-line" />
              <div className="h-4 w-1/3 rounded bg-line" />
              <div className="h-9 w-full rounded-card bg-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="rounded-card border border-dashed border-line bg-white py-16 text-center">
        <p className="font-display text-lg text-ink">Nothing matches yet</p>
        <p className="mt-1 text-sm text-ink/60">Try a different search term or clear the category filter.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

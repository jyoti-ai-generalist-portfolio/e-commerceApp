'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ProductGrid from '../components/ProductGrid';
import { getCacheKey, getCached, setCached, clearCatalogCache } from '../lib/catalogCache';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function CatalogPage() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [servedFromCache, setServedFromCache] = useState(false);

  const requestSeq = useRef(0);

  useEffect(() => {
    fetch('/api/v1/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.data || []))
      .catch(() => setCategories([]));
  }, []);

  const loadPage = useCallback(
    async (targetPage) => {
      const key = getCacheKey({ category, search, sort, page: targetPage });
      const cached = getCached(key);
      if (cached) {
        setProducts(cached.data);
        setTotalPages(cached.total_pages);
        setTotalItems(cached.total_items);
        setServedFromCache(true);
        setLoading(false);
        return;
      }

      const seq = ++requestSeq.current;
      setLoading(true);
      setServedFromCache(false);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: '50',
          sort,
        });
        if (category !== 'all') params.set('category_id', category);
        if (search) params.set('search', search);

        const res = await fetch(`/api/v1/products?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load products');
        if (seq !== requestSeq.current) return; // a newer request superseded this one

        setCached(key, data);
        setProducts(data.data || []);
        setTotalPages(data.total_pages || 1);
        setTotalItems(data.total_items || 0);
      } catch (err) {
        console.error(err);
        if (seq === requestSeq.current) {
          setProducts([]);
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [category, search, sort]
  );

  useEffect(() => {
    loadPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, category, search, sort]);

  // Changing filters clears the memory cache and resets to page 1.
  function applyCategory(next) {
    if (next === category) return;
    clearCatalogCache();
    setCategory(next);
    setPage(1);
  }

  function applySort(next) {
    if (next === sort) return;
    clearCatalogCache();
    setSort(next);
    setPage(1);
  }

  function submitSearch(ev) {
    ev.preventDefault();
    clearCatalogCache();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <section className="border-b border-line py-10 sm:py-14">
        <h1 className="max-w-xl font-display text-3xl leading-tight text-ink sm:text-4xl">
          Considered goods, sourced for people who keep things a while.
        </h1>
        <p className="mt-3 max-w-md text-sm text-ink/60">
          Every item below is in stock and ready to ship. Filter by category or search for something specific.
        </p>
      </section>

      <section className="sticky top-[57px] z-20 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        <form onSubmit={submitSearch} className="mb-3 flex gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products…"
            className="min-h-[44px] flex-1 rounded-card border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="min-h-[44px] rounded-card border border-line px-4 text-sm font-medium text-ink hover:border-accent"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <CategoryPill label="All" active={category === 'all'} onClick={() => applyCategory('all')} />
            {categories.map((c) => (
              <CategoryPill
                key={c.id}
                label={c.name}
                active={category === c.id}
                onClick={() => applyCategory(c.id)}
              />
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => applySort(e.target.value)}
            className="min-h-[44px] rounded-card border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {servedFromCache && !loading && (
          <p className="mt-2 text-[11px] text-ink/40">Showing cached results for this page.</p>
        )}
      </section>

      <section className="py-6">
        <ProductGrid products={products} loading={loading} />
      </section>

      {totalPages > 1 && (
        <nav className="sticky bottom-0 -mx-4 flex items-center justify-between border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:justify-center sm:gap-6 sm:border-none sm:bg-transparent sm:px-0">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="min-h-[44px] rounded-card border border-line px-4 text-sm font-medium text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹ Previous
          </button>
          <span className="text-sm text-ink/70">
            Page {page} of {totalPages} · {totalItems} items
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="min-h-[44px] rounded-card border border-line px-4 text-sm font-medium text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next ›
          </button>
        </nav>
      )}
    </main>
  );
}

function CategoryPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-line bg-white text-ink hover:border-accent'
      }`}
    >
      {label}
    </button>
  );
}

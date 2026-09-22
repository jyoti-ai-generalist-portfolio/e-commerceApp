// Module-scope in-memory cache for catalog batches. Lives for the life of
// the page load (SPA navigation reuses it; a hard refresh clears it, which
// is the intended behavior per the spec — cached pages render instantly
// when the user pages back and forth without hitting the DB again).
const cache = new Map();

export function getCacheKey({ category, search, sort, page }) {
  return `${category || 'all'}_${(search || '').trim().toLowerCase()}_${sort || 'newest'}_page_${page}`;
}

export function getCached(key) {
  return cache.get(key) || null;
}

export function setCached(key, value) {
  cache.set(key, value);
}

export function clearCatalogCache() {
  cache.clear();
}

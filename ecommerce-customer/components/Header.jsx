'use client';

import { useApp } from '../lib/store/AppProviders';

export default function Header() {
  const { user, totalCount, openCart, openAuthModal, logout } = useApp();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
        <a href="/" className="shrink-0 font-display text-xl tracking-tight text-ink">
          Northbank &amp; Co.
        </a>

        <div className="hidden flex-1 sm:block">
          <SearchHint />
        </div>

        <nav className="ml-auto flex items-center gap-3 sm:gap-4">
          {user ? (
            <button
              type="button"
              onClick={logout}
              className="hidden text-sm text-ink/70 hover:text-ink sm:inline"
            >
              {user.email?.split('@')[0]} · Log out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="text-sm font-medium text-ink hover:text-accent"
            >
              Log in
            </button>
          )}

          <button
            type="button"
            onClick={openCart}
            aria-label={`Cart, ${totalCount} item${totalCount === 1 ? '' : 's'}`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink hover:border-accent hover:text-accent"
          >
            <CartIcon />
            {totalCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
                {totalCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}

function SearchHint() {
  return (
    <p className="max-w-xs truncate text-sm text-ink/50">
      Browse the collection below — search and filters are on the catalog page.
    </p>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="21" r="1.4" fill="currentColor" />
      <circle cx="18" cy="21" r="1.4" fill="currentColor" />
    </svg>
  );
}

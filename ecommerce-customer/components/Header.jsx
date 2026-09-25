'use client';

import Link from 'next/link';
import { useApp } from '../lib/store/AppProviders';

export default function Header() {
  // ✅ Restored the correct state variables from your old context setup
  const { user, totalCount, openCart, openAuthModal, logout } = useApp();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        {/* Updated brand identity text to match your original store setup */}
        <Link href="/" className="font-display text-lg font-medium text-ink">
          Northbank &amp; Co.
        </Link>

        <div className="flex items-center gap-4">
          {/* Dynamic Auth Links Area */}
          {user ? (
            <button
              type="button"
              onClick={logout}
              className="text-sm text-ink/70 hover:text-ink"
              title={`Logged in as ${user.email}`}
            >
              {user.email?.split('@')[0]} · <span className="underline">Log out</span>
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

          {/* Cart Icon & Trigger Toggle */}
          <button
            type="button"
            onClick={openCart}
            aria-label={`Cart, ${totalCount} item${totalCount === 1 ? '' : 's'}`}
            className="relative flex h-10 items-center gap-2 rounded-card border border-line px-3 text-sm text-ink hover:border-accent"
          >
            Cart
            {totalCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink px-1 text-[11px] font-medium text-paper">
                {totalCount}
              </span>
            )}
          </button>

          {/* Avatar Visual Badge Indicator */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-xs font-semibold text-ink/70 bg-accent-soft"
            title={user ? user.email : 'Guest'}
          >
            {user ? (user.email || '?').slice(0, 1).toUpperCase() : 'G'}
          </div>
        </div>
      </div>
    </header>
  );
}

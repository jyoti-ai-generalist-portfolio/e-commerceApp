"use client";

import { useState } from "react";

const RANGE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Custom", value: "custom" },
];

export default function AdminTopBar({ admin, range, onRangeChange, onSearch }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex flex-col gap-3 border-b border-hairline bg-surface px-6 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <input
          type="search"
          placeholder="Search orders, products, customers…"
          onChange={(e) => onSearch?.(e.target.value.trim())}
          className="w-72 rounded-sm border border-hairline bg-canvas px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div className="flex items-center gap-3">
        <select
          value={range}
          onChange={(e) => onRangeChange(e.target.value)}
          className="rounded-sm border border-hairline bg-surface px-3 py-2 text-[14px] outline-none focus:border-ink"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-sm border border-hairline px-3 py-2 text-[14px] hover:bg-canvas"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[12px] text-white">
              {(admin?.name || "A").charAt(0).toUpperCase()}
            </span>
            {admin?.name || "Admin"}
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-44 rounded-sm border border-hairline bg-surface shadow-sm">
              <a href="/admin/settings" className="block px-4 py-2 text-[14px] text-ink2 hover:bg-canvas">
                Account settings
              </a>
              <a
                href="/admin/login"
                onClick={async (e) => {
                  e.preventDefault();
                  await fetch("/api/v1/admin/auth/logout", { method: "POST" }).catch(() => {});
                  window.location.href = "/admin/login";
                }}
                className="block px-4 py-2 text-[14px] text-alert hover:bg-canvas"
              >
                Log out
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

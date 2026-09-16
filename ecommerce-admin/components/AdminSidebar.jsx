"use client";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Catalog", href: "/admin/catalog" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminSidebar({ active = "Dashboard" }) {
  return (
    <aside className="hidden w-56 shrink-0 bg-ink text-white md:flex md:flex-col">
      <div className="px-5 py-6">
        <span className="font-display text-xl">Store Admin</span>
      </div>
      <nav className="flex-1 px-2">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`mb-1 block rounded-sm px-3 py-2 text-[14px] transition ${
              item.label === active
                ? "bg-ink-light bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="px-5 py-4 text-[12px] text-white/40">v1.0 · Admin Portal</div>
    </aside>
  );
}

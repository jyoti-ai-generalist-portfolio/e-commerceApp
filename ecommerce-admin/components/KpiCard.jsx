"use client";

export default function KpiCard({ label, value, changePct, accentColor, isLoading, href }) {
  const isPositive = changePct >= 0;

  if (isLoading) {
    return (
      <div className="rounded-sm border border-hairline bg-surface p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-canvas" />
        <div className="mt-4 h-7 w-32 animate-pulse rounded bg-canvas" />
        <div className="mt-3 h-3 w-16 animate-pulse rounded bg-canvas" />
      </div>
    );
  }

  const content = (
    <div
      className="rounded-sm border border-hairline bg-surface p-5"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink2">{value}</p>
      {typeof changePct === "number" ? (
        <p className={`mt-2 text-[13px] ${isPositive ? "text-accent" : "text-alert"}`}>
          {isPositive ? "▲" : "▼"} {Math.abs(changePct)}% vs previous period
        </p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block transition hover:border-ink">
        {content}
      </a>
    );
  }

  return content;
}

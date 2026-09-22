'use client';

import { useApp } from '../lib/store/AppProviders';

export default function ToastHost() {
  const { toasts } = useApp();

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`rounded-card px-4 py-2.5 text-sm font-medium shadow-md ${
            t.type === 'error' ? 'bg-danger text-white' : 'bg-ink text-paper'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

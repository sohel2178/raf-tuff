'use client';

import clsx from 'clsx';
import { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: number; message: string; tone: 'ok' | 'error' };
const Ctx = createContext<(message: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg',
              t.tone === 'ok' ? 'bg-ink' : 'bg-danger',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

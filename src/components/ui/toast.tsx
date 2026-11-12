'use client';

import clsx from 'clsx';
import { AnimatePresence, m } from 'framer-motion';
import { createContext, useCallback, useContext, useState } from 'react';
import { EASE_OUT, spring } from '@/lib/motion';

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
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
              exit={{ opacity: 0, y: 12, transition: { duration: 0.18, ease: EASE_OUT } }}
              className={clsx(
                'pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg',
                t.tone === 'ok' ? 'bg-ink' : 'bg-danger',
              )}
            >
              {t.message}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

'use client';

import clsx from 'clsx';
import { AnimatePresence, m, useDragControls, type PanInfo } from 'framer-motion';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { EASE_OUT, dur, spring } from '@/lib/motion';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

function useAutoFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  return ref;
}

const SM = '(min-width: 640px)';
/** true at ≥sm (side drawer / centred modal), false on phones (bottom sheet) */
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(SM);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(SM).matches,
    () => true,
  );
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <m.div
      className="absolute inset-0 bg-ink/35"
      onClick={onClose}
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: dur.base } }}
      exit={{ opacity: 0, transition: { duration: dur.fast } }}
    />
  );
}

/** Drag the grab bar down past this (or flick) to dismiss a bottom sheet. */
const dismissSheet = (onClose: () => void) => (_: unknown, info: PanInfo) => {
  if (info.offset.y > 120 || info.velocity.y > 600) onClose();
};

function GrabBar() {
  return (
    <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
      <span className="h-1 w-10 rounded-full bg-line-strong" />
    </div>
  );
}

/** Right-side drawer on desktop, bottom sheet (drag down to close) on mobile. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEscape(open, onClose);
  const ref = useAutoFocus(open);
  const wide = useWide();
  const drag = useDragControls();
  const from = wide ? { x: '100%' } : { y: '100%' };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <Backdrop onClose={onClose} />
          <m.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={from}
            animate={{ x: 0, y: 0, transition: spring.sheet }}
            exit={{ ...from, transition: { duration: dur.base, ease: EASE_OUT } }}
            drag={wide ? false : 'y'}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={dismissSheet(onClose)}
            className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-paper outline-none sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[460px] sm:rounded-none sm:border-l sm:border-line-strong"
          >
            <div onPointerDown={(e) => !wide && drag.start(e)} className="touch-none sm:touch-auto">
              <GrabBar />
              <div className="flex items-center justify-between gap-4 border-b border-line px-5 pt-2 pb-4 sm:pt-4">
                <div className="min-w-0 font-display text-lg font-bold">{title}</div>
                <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Centred dialog on desktop, bottom sheet on mobile. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide: wideModal,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEscape(open, onClose);
  const ref = useAutoFocus(open);
  const wide = useWide();
  const drag = useDragControls();
  const from = wide ? { opacity: 0, scale: 0.96, y: 8 } : { opacity: 1, scale: 1, y: '100%' };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center sm:p-4">
          <Backdrop onClose={onClose} />
          <m.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={from}
            animate={{ opacity: 1, scale: 1, y: 0, transition: wide ? { duration: dur.base, ease: EASE_OUT } : spring.sheet }}
            exit={{ ...from, transition: { duration: dur.fast, ease: EASE_OUT } }}
            drag={wide ? false : 'y'}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={dismissSheet(onClose)}
            className={clsx(
              'relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-paper outline-none sm:rounded-2xl',
              wideModal ? 'sm:max-w-xl' : 'sm:max-w-md',
            )}
          >
            <div onPointerDown={(e) => !wide && drag.start(e)} className="touch-none sm:touch-auto">
              <GrabBar />
              <div className="flex items-center justify-between px-5 pt-2 pb-2 sm:pt-5">
                <h2 className="font-display text-xl font-bold">{title}</h2>
                <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-3">{children}</div>
            {footer && <div className="flex justify-end gap-2 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

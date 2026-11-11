'use client';

import clsx from 'clsx';
import { useEffect, useRef } from 'react';

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

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** Right-side drawer on desktop, bottom sheet on mobile. */
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-paper outline-none sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[460px] sm:rounded-none sm:border-l sm:border-line-strong"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0 font-display text-lg font-bold">{title}</div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-paper outline-none sm:rounded-2xl',
          wide ? 'sm:max-w-xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

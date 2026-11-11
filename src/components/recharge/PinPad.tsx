'use client';

import clsx from 'clsx';
import { forwardRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  disabled?: boolean;
  /** bump to replay the shake (wrong PIN) */
  shakeKey?: number;
  autoFocus?: boolean;
};

/**
 * Six-cell PIN entry over one real input, so the numeric keypad, paste,
 * password managers and screen readers all work as for a normal field.
 */
export const PinPad = forwardRef<HTMLInputElement, Props>(function PinPad(
  { value, onChange, error, disabled, shakeKey = 0, autoFocus },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, 5);
  return (
    <div>
      <label htmlFor="recharge-pin" className="text-sm text-muted">
        Enter your recharge PIN to authorise
      </label>
      <div key={shakeKey} className={clsx('relative mt-2', shakeKey > 0 && 'animate-shake')}>
        <input
          ref={ref}
          id="recharge-pin"
          name="recharge-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={6}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby="recharge-pin-msg"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer text-base opacity-0 disabled:cursor-not-allowed"
        />
        <div className="grid grid-cols-6 gap-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => {
            const filled = i < value.length;
            const isActive = focused && !disabled && i === active;
            return (
              <div
                key={i}
                className={clsx(
                  'grid h-13 place-items-center rounded-lg border-2 bg-paper transition-colors',
                  disabled && 'opacity-50',
                  isActive ? 'border-flag bg-surface' : error ? 'border-danger/60' : filled ? 'border-ink-2' : 'border-line-strong',
                )}
              >
                {filled ? (
                  <span className="size-3 rounded-full bg-ink" />
                ) : isActive ? (
                  <span className="h-5 w-0.5 animate-pulse-soft bg-flag" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <p id="recharge-pin-msg" role={error ? 'alert' : undefined} className={clsx('mt-2 min-h-5 text-sm', error ? 'text-danger' : 'text-muted')}>
        {error ?? 'Ask your admin if you don’t know the PIN.'}
      </p>
    </div>
  );
});

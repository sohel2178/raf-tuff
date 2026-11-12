'use client';

import clsx from 'clsx';
import { AnimatePresence, animate, m, useAnimationControls, useMotionValue, useTransform } from 'framer-motion';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StatusBadge } from '@/components/ui/status';
import { EASE_OUT, spring } from '@/lib/motion';
import type { RechargeStatus } from '@/lib/types';

/**
 * A figure that counts to its value. With `fromZero` it also counts up on first paint
 * (use for a page's one headline number); otherwise only changes animate.
 */
export function CountUp({
  value,
  format = (v) => Math.round(v).toLocaleString('en-IN'),
  fromZero,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  fromZero?: boolean;
  className?: string;
}) {
  const mv = useMotionValue(fromZero ? 0 : value);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: fromZero ? 0.9 : 0.5, ease: EASE_OUT });
    return () => controls.stop();
  }, [mv, value, fromZero]);
  return <m.span className={clsx('tabular', className)}>{text}</m.span>;
}

/** Status badge that lands like a stamp when it changes while you watch (not on first paint). */
export function LiveStatus({ status, compact, className }: { status: RechargeStatus; compact?: boolean; className?: string }) {
  return (
    <span className={clsx('relative inline-flex', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={status}
          initial={{ scale: 1.3, rotate: -7, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={spring.stamp}
          className="inline-flex"
        >
          <StatusBadge status={status} className={compact ? '!px-2 !text-xs' : undefined} />
        </m.span>
      </AnimatePresence>
    </span>
  );
}

/** Rubber stamp: slams in from large and tilted, settles at a slight angle. Re-stamps when `stampKey` changes. */
export function Stamp({
  stampKey,
  rotate = -8,
  delay = 0,
  className,
  children,
  role,
}: {
  stampKey: string;
  rotate?: number;
  delay?: number;
  className?: string;
  children: React.ReactNode;
  role?: string;
}) {
  return (
    <AnimatePresence mode="popLayout">
      <m.div
        key={stampKey}
        role={role}
        initial={{ scale: 1.6, rotate: rotate - 6, opacity: 0 }}
        animate={{ scale: 1, rotate, opacity: 1 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
        transition={{ ...spring.stamp, delay }}
        className={clsx('inline-block', className)}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

export type ShakeHandle = { shake: () => void };

/** Wraps content that jolts sideways on demand (wrong PIN, wrong password). */
export const Shake = forwardRef<ShakeHandle, { className?: string; children: React.ReactNode }>(function Shake({ className, children }, ref) {
  const controls = useAnimationControls();
  useImperativeHandle(ref, () => ({
    shake: () => void controls.start({ x: [0, -7, 7, -6, 6, -3, 3, 0], transition: { duration: 0.38, ease: 'easeInOut' } }),
  }));
  return (
    <m.div animate={controls} className={className}>
      {children}
    </m.div>
  );
});

/** Replays a shake whenever `trigger` changes to a new non-zero value. */
export function ShakeOn({ trigger, className, children }: { trigger: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<ShakeHandle>(null);
  useEffect(() => {
    if (trigger > 0) ref.current?.shake();
  }, [trigger]);
  return (
    <Shake ref={ref} className={className}>
      {children}
    </Shake>
  );
}

/**
 * The single moving indicator for "this one is chosen". Render it inside the active item only;
 * framer-motion glides it between items sharing the same `id`.
 */
export function SlidingMarker({ id, className }: { id: string; className?: string }) {
  return <m.span layoutId={id} aria-hidden transition={spring.marker} className={clsx('absolute', className)} />;
}

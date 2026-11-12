/**
 * Motion language: the receipt printer and the rubber stamp.
 * - issued things (receipts, toasts, sheets) feed out like paper
 * - decided things (statuses, PAID, wrong PIN) land with a stamp or a jolt
 * - chosen things (nav, tabs, segments) move one sliding marker
 * - money counts to its value
 */
import type { Transition, Variants } from 'framer-motion';

export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

export const dur = { fast: 0.15, base: 0.26, slow: 0.42 } as const;

export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 30 },
  stamp: { type: 'spring', stiffness: 520, damping: 22 },
  sheet: { type: 'spring', stiffness: 380, damping: 36 },
  marker: { type: 'spring', stiffness: 460, damping: 36 },
} satisfies Record<string, Transition>;

/** Paper feeding out of a slot: revealed top-down while sliding down a touch. */
export const feed: Variants = {
  hidden: { clipPath: 'inset(0 0 100% 0)', y: -14 },
  show: { clipPath: 'inset(0 0 0% 0)', y: 0, transition: { duration: dur.slow, ease: EASE_OUT } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.base, ease: EASE_OUT } },
};

export const rise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: EASE_OUT } },
};

/** Height unfold for small panels/banners (use with overflow-hidden). */
export const unfold = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { duration: dur.base, ease: EASE_OUT } },
  exit: { height: 0, opacity: 0, transition: { duration: dur.fast, ease: EASE_OUT } },
} as const;

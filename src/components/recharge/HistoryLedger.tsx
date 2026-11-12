'use client';

import clsx from 'clsx';
import { AnimatePresence, LayoutGroup, m } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { CountUp, LiveStatus } from '@/components/motion';
import { OperatorMark } from '@/components/ui/status';
import { creatorName, dayLabel, dhakaDayKey, fmtClock, fmtDateTime, fmtPhone, taka } from '@/lib/format';
import { EASE_OUT } from '@/lib/motion';
import type { Recharge, RechargeStatus } from '@/lib/types';


/** Only rows that need a second look get an edge; successful ones stay quiet. */
const edge: Partial<Record<RechargeStatus, string>> = {
  Pending: 'var(--color-marigold)',
  Processing: 'var(--color-marigold)',
  Failed: 'var(--color-danger)',
  Unknown: 'var(--color-unknown)',
};

const COLS = 'md:grid md:grid-cols-[84px_minmax(0,1.25fr)_52px_84px_minmax(0,1fr)_minmax(0,1fr)_28px] md:items-center md:gap-x-4';

type Group = { key: string; items: Recharge[]; success: number };

/**
 * History as a day ledger: rows grouped by Dhaka day under sticky day headers.
 * Totals are for the rows on this page; edges of a page say so instead of implying a full day.
 */
export function HistoryLedger({
  items,
  page,
  totalPages,
  onOpen,
  linkNumbers = true,
}: {
  items: Recharge[];
  page: number;
  totalPages: number;
  onOpen: (trxid: string) => void;
  linkNumbers?: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of items) {
      const key = dhakaDayKey(r.createdAt);
      const g = map.get(key) ?? { key, items: [], success: 0 };
      g.items.push(r);
      if (r.status === 'Success') g.success += r.amount;
      map.set(key, g);
    }
    return [...map.values()];
  }, [items]);

  // One orchestrated moment: day groups settle in, staggered, on the first render only.
  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);

  return (
    <div>
      <div className={clsx(COLS, 'hidden border-b border-line px-5 py-2.5 text-sm text-muted md:grid')} aria-hidden>
        <span>Time</span>
        <span>Number</span>
        <span>Operator</span>
        <span className="text-right">Amount</span>
        <span>Status</span>
        <span>Sent by</span>
        <span />
      </div>

      <LayoutGroup>
        <AnimatePresence mode="popLayout" initial>
          {groups.map((g, gi) => {
            const { name, date } = dayLabel(g.key);
            const continuesBefore = gi === 0 && page > 1;
            const continuesAfter = gi === groups.length - 1 && page < totalPages;
            const headingId = `day-${g.key}`;
            return (
              <m.section
                key={g.key}
                layout="position"
                aria-labelledby={headingId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT, delay: firstPaint.current ? gi * 0.06 : 0 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              >
                <header className="sticky top-14 z-10 border-b border-dashed border-line-strong bg-surface/95 px-4 pt-4 pb-2.5 backdrop-blur-sm sm:px-5 lg:top-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id={headingId} className="flex items-baseline gap-2.5">
                      <span className="font-display text-[19px] leading-none font-extrabold tracking-[-0.01em]">{name}</span>
                      <span className="text-sm text-muted">{date}</span>
                    </h2>
                    <p className="flex items-baseline gap-4 text-sm text-muted">
                      <span className="tabular">
                        {g.items.length} recharge{g.items.length === 1 ? '' : 's'}
                      </span>
                      <span>
                        <CountUp value={g.success} format={(v) => taka(Math.round(v))} className="font-semibold text-flag-deep" /> successful
                      </span>
                    </p>
                  </div>
                  {(continuesBefore || continuesAfter) && (
                    <p className="mt-1 text-xs text-muted">
                      {continuesBefore && continuesAfter
                        ? 'This day runs across pages; totals cover this page only.'
                        : continuesBefore
                          ? 'Continued from the previous page; totals cover this page only.'
                          : 'Continues on the next page; totals cover this page only.'}
                    </p>
                  )}
                </header>

                <ul>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {g.items.map((r) => (
                      <Row key={r.trxid} r={r} onOpen={onOpen} linkNumber={linkNumbers} />
                    ))}
                  </AnimatePresence>
                </ul>
              </m.section>
            );
          })}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}

function Row({ r, onOpen, linkNumber, ref }: { r: Recharge; onOpen: (trxid: string) => void; linkNumber: boolean; ref?: React.Ref<HTMLLIElement> }) {
  const by = r.source === 'external-api' ? 'API' : creatorName(r.createdBy);
  const color = edge[r.status];
  return (
    <m.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      transition={{ duration: 0.26, ease: EASE_OUT }}
      onClick={() => onOpen(r.trxid)}
      className="group relative cursor-pointer border-b border-line last:border-0 hover:bg-paper/60"
    >
      <m.span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        initial={false}
        animate={{ backgroundColor: color ?? 'rgba(0,0,0,0)' }}
        transition={{ duration: 0.4 }}
      />

      {/* ≥md: one ledger line */}
      <div className={clsx(COLS, 'hidden px-5 py-3 text-[14.5px] md:grid')}>
        <span className="tabular whitespace-nowrap text-muted" title={fmtDateTime(r.createdAt)}>
          {fmtClock(r.createdAt)}
        </span>
        {linkNumber ? (
          <Link
            href={`/numbers/${r.number}`}
            onClick={(e) => e.stopPropagation()}
            className="tabular w-fit font-medium whitespace-nowrap hover:text-flag hover:underline"
          >
            {fmtPhone(r.number)}
          </Link>
        ) : (
          <span className="tabular font-medium whitespace-nowrap">{fmtPhone(r.number)}</span>
        )}
        <OperatorMark op={r.operator} size="sm" />
        <span className="tabular text-right font-semibold">{taka(r.amount)}</span>
        <LiveStatus status={r.status} />
        <span className="truncate text-ink-2">{by}</span>
        <OpenButton trxid={r.trxid} onOpen={onOpen} />
      </div>

      {/* phones: stacked */}
      <div className="flex items-center gap-3 px-4 py-3 md:hidden">
        <OperatorMark op={r.operator} size="md" />
        <div className="min-w-0 flex-1">
          <p className="tabular font-medium">{fmtPhone(r.number)}</p>
          <p className="flex gap-2 truncate text-sm text-muted">
            <span className="tabular shrink-0">{fmtClock(r.createdAt)}</span>
            <span className="truncate">{by}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="tabular font-semibold">{taka(r.amount)}</span>
          <LiveStatus status={r.status} compact />
        </div>
      </div>
    </m.li>
  );
}

function OpenButton({ trxid, onOpen }: { trxid: string; onOpen: (trxid: string) => void }) {
  return (
    <button
      type="button"
      aria-label="Open recharge details"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(trxid);
      }}
      className="grid size-7 place-items-center rounded-md text-muted transition-colors group-hover:text-flag hover:bg-flag-tint"
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/overlay';
import { StatusBadge } from '@/components/ui/status';
import { REPEAT_WINDOW_DAYS } from '@/lib/constants';
import { creatorName, fmtDateTime, fmtPhone, taka } from '@/lib/format';
import type { RechargeStatus } from '@/lib/types';

export type LastDone = { amount: number; status: RechargeStatus; createdAt: string; createdBy?: unknown };

/** "today", "yesterday", "3 days ago" */
function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

/** One line describing the earlier recharge: ৳20 on 14 Nov, 02:01 pm (3 days ago) by Fahim */
export function lastDoneLine(l: LastDone) {
  return `${taka(l.amount)} on ${fmtDateTime(l.createdAt)} (${daysAgo(l.createdAt)}) by ${creatorName(l.createdBy)}`;
}

/** Single recharge: ask before topping up a number that was recharged within the window. */
export function RepeatWarningSingle({
  open,
  number,
  last,
  onCancel,
  onProceed,
}: {
  open: boolean;
  number: string;
  last: LastDone | null;
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Already recharged recently"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onProceed}>Recharge again</Button>
        </>
      }
    >
      {last && (
        <div className="rounded-lg border border-marigold/50 bg-marigold-tint px-4 py-3 text-[#6e5000]">
          <p className="tabular font-display text-xl font-bold text-ink">{fmtPhone(number)}</p>
          <p className="mt-1">{lastDoneLine(last)}</p>
          <StatusBadge status={last.status} className="mt-2" />
        </div>
      )}
      <p className="mt-3 text-muted">
        This number was topped up in the last {REPEAT_WINDOW_DAYS} days. Check with the customer before sending another one.
      </p>
    </Modal>
  );
}

export type RepeatRow = { key: string; number: string; amount: number | null; last: LastDone };

/** Bulk: list the numbers recharged within the window; unticked ones are removed (all start unticked). */
export function RepeatWarningBulk({
  open,
  rows,
  onBack,
  onContinue,
}: {
  open: boolean;
  rows: RepeatRow[];
  onBack: () => void;
  /** keys of flagged rows to remove from the list */
  onContinue: (removeKeys: string[]) => void;
}) {
  const [keep, setKeep] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setKeep(new Set());
  }, [open]);

  const removeCount = rows.length - keep.size;
  const toggle = (k: string) =>
    setKeep((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <Modal
      open={open}
      onClose={onBack}
      wide
      title={`${rows.length} number${rows.length === 1 ? ' was' : 's were'} recharged recently`}
      footer={
        <>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button onClick={() => onContinue(rows.filter((r) => !keep.has(r.key)).map((r) => r.key))}>
            {keep.size === 0 ? `Remove ${rows.length} and continue` : removeCount ? `Keep ${keep.size}, remove ${removeCount}` : `Keep all ${rows.length}`}
          </Button>
        </>
      }
    >
      <p className="text-muted">
        These were topped up in the last {REPEAT_WINDOW_DAYS} days. Tick the ones you still want to send; the rest are removed from the list.
      </p>
      <div className="mt-3 flex gap-4 text-sm font-medium">
        <button type="button" className="text-flag hover:underline" onClick={() => setKeep(new Set(rows.map((r) => r.key)))}>
          Keep all
        </button>
        <button type="button" className="text-flag hover:underline" onClick={() => setKeep(new Set())}>
          Remove all
        </button>
      </div>
      <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
        {rows.map((r) => {
          const kept = keep.has(r.key);
          return (
            <li key={r.key}>
              <label className={clsx('flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-opacity', !kept && 'opacity-70')}>
                <input type="checkbox" checked={kept} onChange={() => toggle(r.key)} className="mt-1 size-4 shrink-0 accent-[var(--color-flag)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3">
                    <span className="tabular font-medium">{fmtPhone(r.number)}</span>
                    <span className="tabular text-sm text-muted">sending {taka(r.amount)}</span>
                    <span className={clsx('ml-auto text-xs font-medium', kept ? 'text-flag-deep' : 'text-danger')}>{kept ? 'Keep' : 'Remove'}</span>
                  </span>
                  <span className="block text-sm text-[#6e5000]">Last: {lastDoneLine(r.last)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

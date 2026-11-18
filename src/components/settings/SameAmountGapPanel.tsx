'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSameAmountGap } from '@/components/recharge/QueuedNotice';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/field';
import { Panel, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { unfold } from '@/lib/motion';
import type { SameAmountGap } from '@/lib/types';

const PRESETS = [65_000, 90_000, 120_000] as const;
type Choice = `${(typeof PRESETS)[number]}` | 'custom';
const fmt = (ms: number) => `${Math.round(ms / 1000)} s`;

/** Admin control: minimum time between two recharges with the same amount (Success TopUp rule: ≥ 60 s). */
export function SameAmountGapPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const gap = useSameAmountGap();
  const [choice, setChoice] = useState<Choice>('65000');
  const [customSec, setCustomSec] = useState('');

  useEffect(() => {
    if (!gap.data) return;
    const ms = gap.data.gapMs;
    if ((PRESETS as readonly number[]).includes(ms)) setChoice(String(ms) as Choice);
    else {
      setChoice('custom');
      setCustomSec(String(Math.round(ms / 1000)));
    }
  }, [gap.data]);

  const customMs = Math.round(Number(customSec) * 1000);
  const customError =
    choice !== 'custom'
      ? null
      : customSec === '' || Number.isNaN(customMs)
        ? 'Enter seconds'
        : customMs < 60_000 || customMs > 600_000
          ? 'Between 60 and 600 seconds'
          : null;
  const selectedMs = choice === 'custom' ? customMs : Number(choice);
  const dirty = gap.data != null && !customError && selectedMs !== gap.data.gapMs;

  const save = useMutation({
    mutationFn: (gapMs: number | null) => api<SameAmountGap>('/api/settings/same-amount-gap', { method: 'PATCH', body: { gapMs } }),
    onSuccess: (r) => {
      qc.setQueryData(['same-amount-gap'], r);
      toast(`Saved: same-amount recharges ${fmt(r.gapMs)} apart`);
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <Panel className="p-5">
      <h2 className="font-display text-lg font-bold">Same-amount gap</h2>
      <p className="mt-1 text-muted">
        Success TopUp blocks this server&apos;s IP if two recharges with the <b>same amount</b> reach them less than 60 seconds apart, even
        to different numbers. A recharge that would break this rule is queued and sent automatically when its turn comes. Different
        amounts are not delayed.
      </p>
      {!gap.data ? (
        <Skeleton className="mt-4 h-10" />
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty) save.mutate(selectedMs);
          }}
        >
          <Segmented<Choice>
            label="Minimum time between same-amount recharges"
            className="mt-1.5 w-full"
            value={choice}
            onChange={setChoice}
            options={[...PRESETS.map((ms) => ({ value: String(ms) as Choice, label: fmt(ms) })), { value: 'custom' as Choice, label: 'Custom' }]}
          />
          <AnimatePresence initial={false}>
            {choice === 'custom' && (
              <m.div key="custom" {...unfold} className="overflow-hidden">
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={customSec}
                    onChange={(e) => setCustomSec(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    inputMode="numeric"
                    placeholder="e.g. 75"
                    aria-label="Seconds between same-amount recharges"
                    aria-invalid={!!customError}
                    className="tabular h-10 w-28 rounded-lg border border-line-strong bg-surface px-3 focus:border-flag focus:ring-3 focus:ring-flag/15 focus:outline-none aria-invalid:border-danger"
                  />
                  <span className="text-muted">seconds (60–600)</span>
                </div>
              </m.div>
            )}
          </AnimatePresence>
          <p className={customError ? 'mt-2 text-sm text-danger' : 'mt-2 text-sm text-muted'}>
            {customError ?? '65 s is the default: the 60 s rule plus a 5 s safety margin. Never go below 60 s.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button type="submit" loading={save.isPending && save.variables !== null} disabled={!dirty}>
              Save
            </Button>
            {gap.data.source === 'app' && (
              <button
                type="button"
                onClick={() => save.mutate(null)}
                disabled={save.isPending}
                className="text-sm font-medium text-flag hover:underline disabled:opacity-50"
              >
                Reset to default
              </button>
            )}
            <span className="text-sm text-muted">
              Now: {fmt(gap.data.gapMs)}
              {gap.data.source === 'default' ? ' (default)' : ''}
            </span>
          </div>
        </form>
      )}
    </Panel>
  );
}

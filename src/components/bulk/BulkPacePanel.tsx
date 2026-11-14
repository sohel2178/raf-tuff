'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/field';
import { Panel, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { unfold } from '@/lib/motion';
import type { BulkPace } from '@/lib/types';

const PRESETS = [1000, 3000, 5000, 10_000] as const;
type Choice = `${(typeof PRESETS)[number]}` | 'custom';

/** 3000 → "3 s", 500 → "0.5 s", 0 → "no pause" */
export const fmtGap = (ms: number) => (ms === 0 ? 'no pause' : `${Number((ms / 1000).toFixed(1))} s`);

/** Shared query: the settings panel edits it, the bulk confirm sheet shows it. */
export const useBulkPace = () =>
  useQuery({ queryKey: ['bulk-pace'], queryFn: () => api<BulkPace>('/api/settings/bulk'), staleTime: 60_000 });

/** Admin control for the pause between numbers in a bulk batch. */
export function BulkPacePanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const pace = useBulkPace();
  const [choice, setChoice] = useState<Choice>('3000');
  const [customSec, setCustomSec] = useState('');

  // Reflect the saved value once it loads
  useEffect(() => {
    if (!pace.data) return;
    const ms = pace.data.gapMs;
    if ((PRESETS as readonly number[]).includes(ms)) setChoice(String(ms) as Choice);
    else {
      setChoice('custom');
      setCustomSec(String(ms / 1000));
    }
  }, [pace.data]);

  const customMs = Math.round(Number(customSec) * 1000);
  const customError =
    choice !== 'custom' ? null : customSec === '' || Number.isNaN(customMs) ? 'Enter seconds' : customMs < 0 || customMs > 60_000 ? 'Between 0 and 60 seconds' : null;
  const selectedMs = choice === 'custom' ? customMs : Number(choice);
  const dirty = pace.data != null && !customError && selectedMs !== pace.data.gapMs;
  // 100 numbers: the pause plus ~1.5 s for the provider's reply each
  const per100Min = Math.max(1, Math.round(((selectedMs / 1000 + 1.5) * 100) / 60));

  const save = useMutation({
    mutationFn: (gapMs: number | null) => api<BulkPace>('/api/settings/bulk', { method: 'PATCH', body: { gapMs } }),
    onSuccess: (r) => {
      qc.setQueryData(['bulk-pace'], r);
      toast(`Saved: ${fmtGap(r.gapMs)} between numbers`);
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <Panel className="p-5">
      <h2 className="font-display text-lg font-bold">Bulk recharge</h2>
      <p className="mt-1 text-muted">
        A batch never sends everything at once. Numbers go one at a time, with this pause between them. Changes apply to batches already
        sending, from the next number.
      </p>
      {!pace.data ? (
        <Skeleton className="mt-4 h-10" />
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty) save.mutate(selectedMs);
          }}
        >
          <p className="text-sm font-medium text-ink-2" id="pace-label">
            Pause between numbers
          </p>
          <Segmented<Choice>
            label="Pause between numbers"
            className="mt-1.5 w-full"
            value={choice}
            onChange={setChoice}
            options={[
              ...PRESETS.map((ms) => ({ value: String(ms) as Choice, label: fmtGap(ms) })),
              { value: 'custom' as Choice, label: 'Custom' },
            ]}
          />
          <AnimatePresence initial={false}>
            {choice === 'custom' && (
              <m.div key="custom" {...unfold} className="overflow-hidden">
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={customSec}
                    onChange={(e) => setCustomSec(e.target.value.replace(/[^\d.]/g, '').slice(0, 4))}
                    inputMode="decimal"
                    placeholder="e.g. 2.5"
                    aria-label="Seconds between numbers"
                    aria-invalid={!!customError}
                    className="tabular h-10 w-28 rounded-lg border border-line-strong bg-surface px-3 focus:border-flag focus:ring-3 focus:ring-flag/15 focus:outline-none aria-invalid:border-danger"
                  />
                  <span className="text-muted">seconds (0–60)</span>
                </div>
              </m.div>
            )}
          </AnimatePresence>
          <p className={customError ? 'mt-2 text-sm text-danger' : 'mt-2 text-sm text-muted'}>
            {customError ??
              `3 s is the default. At ${fmtGap(selectedMs)}, 100 numbers take about ${per100Min} min, including the provider's reply time (usually 1–2 s each).`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button type="submit" loading={save.isPending && save.variables !== null} disabled={!dirty}>
              Save
            </Button>
            {pace.data.source === 'app' && (
              <button
                type="button"
                onClick={() => save.mutate(null)}
                disabled={save.isPending}
                className="text-sm font-medium text-flag hover:underline disabled:opacity-50"
              >
                Reset to default
              </button>
            )}
            <span className="text-sm text-muted">Now: {fmtGap(pace.data.gapMs)}{pace.data.source === 'default' ? ' (default)' : ''}</span>
          </div>
        </form>
      )}
    </Panel>
  );
}

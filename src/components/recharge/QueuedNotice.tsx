'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { creatorId, fmtTime, taka } from '@/lib/format';
import type { Recharge, SameAmountGap } from '@/lib/types';

/** True while the recharge is saved but not yet sent (waiting for Success TopUp's same-amount gap). */
export const isQueued = (r: Pick<Recharge, 'status' | 'queue'> | null | undefined) =>
  !!r && r.status === 'Pending' && r.queue?.state === 'waiting';

export const useSameAmountGap = () =>
  useQuery({ queryKey: ['same-amount-gap'], queryFn: () => api<SameAmountGap>('/api/settings/same-amount-gap'), staleTime: 60_000 });

/** Seconds left until `at`, ticking every second (0 once passed). */
export function useSecondsLeft(at: string | null | undefined) {
  const target = at ? new Date(at).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  return target ? Math.max(0, Math.ceil((target - now) / 1000)) : 0;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Countdown + Cancel for a queued recharge. Renders nothing once it has been sent. */
export function QueuedNotice({ recharge: r, className }: { recharge: Recharge; className?: string }) {
  const user = useUser();
  const qc = useQueryClient();
  const toast = useToast();
  const gap = useSameAmountGap();
  const left = useSecondsLeft(r.queue?.sendAfter);
  const canCancel = user.role === 'admin' || creatorId(r.createdBy) === user.id;

  const cancel = useMutation({
    mutationFn: () => api<{ recharge: Recharge }>(`/api/recharges/${r.trxid}/cancel`, { method: 'POST' }),
    onSuccess: ({ recharge }) => {
      qc.setQueryData(['recharge', r.trxid], recharge);
      qc.invalidateQueries({ queryKey: ['recharges'] });
      toast('Cancelled. Nothing was sent.');
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ['recharge', r.trxid] });
      toast(e.message, 'error');
    },
  });

  if (!isQueued(r)) return null;
  const gapS = gap.data ? Math.round(gap.data.gapMs / 1000) : 65;
  return (
    <div className={className}>
      <div className="rounded-lg border border-marigold/40 bg-marigold-tint px-3 py-2.5 text-sm text-[#6e5000]" role="status">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-medium">Queued, not sent yet</span>
          <span className="tabular font-display text-base font-bold" aria-live="off">
            {left > 0 ? mmss(left) : 'sending…'}
          </span>
        </p>
        <p className="mt-1">
          Success TopUp needs {gapS} s between two {taka(r.amount)} recharges. This one goes out automatically at{' '}
          <span className="tabular">{fmtTime(r.queue!.sendAfter)}</span>. Don&apos;t send it again.
        </p>
        {canCancel && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2.5"
            onClick={() => cancel.mutate()}
            loading={cancel.isPending}
            disabled={left === 0}
          >
            Cancel this recharge
          </Button>
        )}
      </div>
    </div>
  );
}

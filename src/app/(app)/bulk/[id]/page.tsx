'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, m } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { BatchStatus } from '@/components/bulk/batchStatus';
import { CountUp, LiveStatus } from '@/components/motion';
import { RechargeDrawer } from '@/components/recharge/RechargeDrawer';
import { Button } from '@/components/ui/button';
import { ErrorNote, Panel, PanelHead, Skeleton } from '@/components/ui/misc';
import { OperatorMark } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { newRow } from '@/lib/bulkParse';
import { OPEN_STATUSES } from '@/lib/constants';
import { fmtDateTime, fmtPhone, num, taka } from '@/lib/format';
import { EASE_OUT, spring, unfold } from '@/lib/motion';
import type { BulkBatch, BulkItem } from '@/lib/types';

export default function BulkProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['bulk', id],
    queryFn: () => api<{ batch: BulkBatch }>(`/api/bulk/${id}`).then((r) => r.batch),
    refetchInterval: (query) => {
      const b = query.state.data;
      if (!b) return false;
      if (b.status === 'running') return 1500;
      return b.items.some((i) => i.status && OPEN_STATUSES.includes(i.status)) ? 8000 : false;
    },
  });
  const b = q.data;

  const act = useMutation({
    mutationFn: (action: 'cancel' | 'resume') => api(`/api/bulk/${id}/${action}`, { method: 'POST' }),
    onSuccess: (_r, action) => {
      toast(action === 'cancel' ? 'Remaining numbers skipped' : 'Sending resumed');
      void qc.invalidateQueries({ queryKey: ['bulk', id] });
      void qc.invalidateQueries({ queryKey: ['bulk-list'] });
    },
    onError: (e) => toast(e.message, 'error'),
  });

  if (q.error) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  if (!b)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-28" />
        <Skeleton className="h-80" />
      </div>
    );

  const c = { queued: 0, sending: 0, sent: 0, rejected: 0, skipped: 0 };
  for (const i of b.items) c[i.state]++;
  const settled = c.sent + c.rejected + c.skipped;
  const success = b.items.filter((i) => i.status === 'Success');
  const failed = b.items.filter((i) => i.status === 'Failed' || i.status === 'Cancel');
  const waiting = b.items.filter((i) => i.state === 'sent' && i.status && OPEN_STATUSES.includes(i.status)).length;
  const retryable = b.items.filter((i) => i.state === 'rejected' || i.state === 'skipped' || i.status === 'Failed' || i.status === 'Cancel');
  const canControl = user.role === 'admin' || b.createdBy?.id === user.id;
  const live = b.status === 'running' || b.status === 'paused';

  const retry = () => {
    const rows = retryable.map((i) => newRow({ number: i.number, operator: i.operator, type: i.type, amount: i.amount }));
    try {
      sessionStorage.setItem('stp-bulk-draft', JSON.stringify(rows));
    } catch {
      /* falls back to an empty list */
    }
    router.push('/bulk');
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/bulk" className="text-sm font-medium text-flag hover:underline">
            Bulk recharge
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[32px]">
            <span>
              <span className="tabular">{b.total}</span> numbers, <span className="tabular">{taka(b.amountTotal)}</span>
            </span>
            <BatchStatus status={b.status} />
          </h1>
          <p className="mt-1 text-muted">
            Started {fmtDateTime(b.createdAt)} by {b.createdBy?.name ?? 'someone'}
          </p>
        </div>
        <div className="flex gap-2">
          {canControl && b.status === 'paused' && (
            <Button onClick={() => act.mutate('resume')} loading={act.isPending && act.variables === 'resume'}>
              Resume sending
            </Button>
          )}
          {canControl && live && c.queued > 0 && (
            <Button variant="danger" onClick={() => act.mutate('cancel')} loading={act.isPending && act.variables === 'cancel'}>
              Skip the remaining {c.queued}
            </Button>
          )}
          {!live && retryable.length > 0 && (
            <Button variant="secondary" onClick={retry}>
              Retry {retryable.length} that didn&apos;t go through
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {b.status === 'paused' && (
          <m.div key="paused" {...unfold} className="overflow-hidden">
            <p className="mb-4 rounded-lg border border-unknown/30 bg-unknown-tint px-4 py-3 text-sm text-unknown" role="status">
              Paused: {b.pauseReason ?? 'sending stopped'}. Nothing more is sent until someone resumes it.
            </p>
          </m.div>
        )}
      </AnimatePresence>

      {/* Progress: the bar fills as rows settle; figures count as recharges confirm */}
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="px-5 pt-4">
          <div className="flex items-baseline justify-between text-sm text-muted">
            <span>
              <CountUp value={settled} className="font-display text-xl font-bold text-ink" /> of {b.total} handled
            </span>
            {c.sending > 0 && <span className="animate-pulse-soft text-[#7a5600]">Sending…</span>}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuemin={0} aria-valuemax={b.total} aria-valuenow={settled}>
            <m.div
              className="h-full rounded-full bg-chart"
              initial={false}
              animate={{ width: `${(settled / Math.max(1, b.total)) * 100}%` }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <Figure label="Topped up" value={success.reduce((s, i) => s + i.amount, 0)} money sub={`${num(success.length)} successful`} strong />
          <Figure label="Waiting for operator" value={waiting} />
          <Figure label="Failed" value={failed.length} sub={failed.length ? 'not charged' : undefined} />
          <Figure label="Not sent" value={c.rejected + c.skipped} sub={c.rejected ? `${c.rejected} over a limit or refused` : undefined} />
        </div>
      </section>

      <Panel className="mt-6 overflow-hidden">
        <PanelHead title="Numbers" />
        <ul className="divide-y divide-line">
          {b.items.map((i) => (
            <ItemRow key={i.index} item={i} onOpen={i.trxid ? () => setOpen(i.trxid) : undefined} />
          ))}
        </ul>
      </Panel>

      <RechargeDrawer trxid={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Figure({ label, value, sub, money, strong }: { label: string; value: number; sub?: string; money?: boolean; strong?: boolean }) {
  return (
    <div className={clsx('px-5 py-4', strong ? 'col-span-2 bg-ink text-white sm:col-span-1' : 'bg-surface')}>
      <p className={clsx('text-sm', strong ? 'text-white/70' : 'text-muted')}>{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">
        <CountUp value={value} format={(v) => (money ? taka(Math.round(v)) : num(Math.round(v)))} />
      </p>
      {sub && <p className={clsx('mt-0.5 text-sm', strong ? 'text-white/70' : 'text-muted')}>{sub}</p>}
    </div>
  );
}

function ItemRow({ item: i, onOpen }: { item: BulkItem; onOpen?: () => void }) {
  return (
    <li>
      <button
        type="button"
        disabled={!onOpen}
        onClick={onOpen}
        className={clsx(
          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-opacity sm:px-5',
          onOpen && 'hover:bg-paper/60',
          (i.state === 'queued' || i.state === 'skipped') && 'opacity-55',
        )}
      >
        <span className="tabular w-7 shrink-0 text-right text-sm text-muted">{i.index + 1}</span>
        <OperatorMark op={i.operator} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="tabular font-medium">{fmtPhone(i.number)}</p>
          {(i.error || (i.status === 'Failed' && i.providerMessage)) && (
            <p className="truncate text-sm text-danger">{i.error ?? i.providerMessage}</p>
          )}
        </div>
        <span className="tabular w-16 text-right font-semibold">{taka(i.amount)}</span>
        <span className="flex w-28 justify-end">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={i.state === 'sent' ? 'sent' : i.state}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={spring.snappy}
              className="inline-flex"
            >
              {i.state === 'sent' && i.status ? (
                <LiveStatus status={i.status} compact />
              ) : (
                <span
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                    i.state === 'sending' && 'bg-marigold-tint text-[#7a5600]',
                    i.state === 'queued' && 'bg-paper-2 text-muted',
                    i.state === 'rejected' && 'bg-danger-tint text-[#a5182b]',
                    i.state === 'skipped' && 'bg-cancel-tint text-cancel',
                  )}
                >
                  {i.state === 'sending' && <span className="size-1.5 animate-pulse-soft rounded-full bg-marigold" aria-hidden />}
                  {{ queued: 'Waiting', sending: 'Sending', rejected: 'Not sent', skipped: 'Skipped', sent: 'Sent' }[i.state]}
                </span>
              )}
            </m.span>
          </AnimatePresence>
        </span>
      </button>
    </li>
  );
}

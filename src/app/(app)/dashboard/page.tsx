'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AmountBars } from '@/components/charts/AmountBars';
import { IconBolt, IconRefresh } from '@/components/icons';
import { RechargeDrawer } from '@/components/recharge/RechargeDrawer';
import { Button } from '@/components/ui/button';
import { Empty, ErrorNote, Panel, PanelHead, Skeleton } from '@/components/ui/misc';
import { OperatorMark, StatusBadge, statusColor } from '@/components/ui/status';
import { ApiError, api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { OPEN_STATUSES } from '@/lib/constants';
import { fmtPhone, num, pct, taka, timeAgo } from '@/lib/format';
import type { Paged, Recharge, Totals } from '@/lib/types';

type Summary = {
  totals: Totals;
  open: { pending: number; unknown: number; needsReview: number };
  trend7: (Totals & { day: string })[];
};
type Balance = { result: boolean | null; balance: number | null; driveBalance: number | null; message: string | null; sandbox: boolean };

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const user = useUser();
  const isAdmin = user.role === 'admin';
  const [open, setOpen] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['summary', 'today'],
    queryFn: () => api<Summary>('/api/reports/summary', { query: { preset: 'today' } }),
    refetchInterval: 30_000,
  });
  const balance = useQuery({
    queryKey: ['balance'],
    queryFn: () => api<Balance>('/api/provider/balance'),
    enabled: isAdmin,
    refetchInterval: 60_000,
    retry: false,
  });
  const recent = useQuery({
    queryKey: ['recharges', 'recent'],
    queryFn: () => api<Paged<Recharge>>('/api/recharges', { query: { pageSize: 8 } }),
    refetchInterval: (q) => (q.state.data?.items.some((r) => OPEN_STATUSES.includes(r.status)) ? 8_000 : 30_000),
  });

  const t = summary.data?.totals;
  const o = summary.data?.open;
  const openTotal = o ? o.pending + o.unknown : 0;

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted">
            {greeting()}, {user.name.split(' ')[0]}
          </p>
          <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[32px]">
            {isAdmin ? 'Today at the shop' : 'Your day so far'}
          </h1>
        </div>
        <div className="flex items-center gap-5">
          {isAdmin && (
            <Link href="/users" className="font-medium text-flag underline-offset-4 hover:underline">
              Add employee
            </Link>
          )}
          <Link href="/recharge" className="hidden h-11 items-center gap-2 rounded-lg bg-flag px-5 font-medium text-white hover:bg-flag-deep sm:inline-flex">
            <IconBolt className="size-4" /> New recharge
          </Link>
        </div>
      </div>

      {summary.error && <ErrorNote error={summary.error} retry={() => summary.refetch()} />}

      {/* Headline: today's successful amount */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 bg-ink px-5 py-5 text-white sm:px-6 lg:col-span-1">
          <p className="text-white/70">Topped up today</p>
          {t ? (
            <p className="tabular mt-1 font-display text-[44px] leading-none font-extrabold tracking-[-0.02em]">{taka(t.amount)}</p>
          ) : (
            <Skeleton className="mt-2 h-11 w-40 bg-white/10" />
          )}
          <p className="mt-2 text-sm text-white/70">Counts confirmed recharges only</p>
        </div>
        <Stat label="Recharges" value={t && num(t.count)} sub={t && `${num(t.success)} successful`} />
        <Stat label="Success rate" value={t && pct(t.successRate)} sub={t && `${num(t.failed + t.cancel)} failed or cancelled`} />
        {isAdmin ? (
          <div className="col-span-2 bg-surface px-5 py-4 lg:col-span-1">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">Provider balance</p>
              <button
                onClick={() => api<Balance>('/api/provider/balance', { query: { fresh: true } }).then(() => balance.refetch())}
                className="rounded p-1 text-muted hover:text-ink"
                aria-label="Refresh balance"
              >
                <IconRefresh className="size-4" />
              </button>
            </div>
            {balance.isLoading ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : balance.error ? (
              balance.error instanceof ApiError && balance.error.code === 'PROVIDER_NOT_CONFIGURED' ? (
                <>
                  <p className="mt-1 font-display text-lg font-bold text-muted">Not connected</p>
                  <p className="mt-0.5 text-sm text-muted">Add the Success TopUp key and secret on the server.</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-danger">{balance.error.message}</p>
              )
            ) : (
              <>
                <p className="tabular mt-1 font-display text-2xl font-bold">{taka(balance.data?.balance)}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {balance.data?.sandbox ? 'Sandbox mode' : `Drive balance ${taka(balance.data?.driveBalance)}`}
                </p>
              </>
            )}
          </div>
        ) : (
          <Stat
            wide
            label="Your limit"
            value={taka(user.rechargeLimit)}
            sub={user.dailyLimit != null ? `${taka(user.dailyLimit)} per day` : 'per recharge'}
          />
        )}
      </section>

      {openTotal > 0 && (
        <Link
          href={o!.needsReview ? '/history?needsReview=true' : '/history?status=Pending,Processing,Unknown'}
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-marigold/50 bg-marigold-tint px-5 py-3 hover:border-marigold"
        >
          <span className="flex items-center gap-2.5">
            <span className="size-2 animate-pulse-soft rounded-full bg-marigold" aria-hidden />
            <span>
              <strong className="font-semibold">{openTotal}</strong> waiting for the operator
              {o!.unknown > 0 && <span className="text-[#6e5000]"> · {o!.unknown} unknown</span>}
              {o!.needsReview > 0 && <span className="text-unknown"> · {o!.needsReview} need review</span>}
            </span>
          </span>
          <span className="text-sm font-medium">View</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_1fr] xl:items-start">
        <Panel>
          <PanelHead title="Successful amount, last 7 days" right={<Link href="/reports" className="text-sm font-medium text-flag hover:underline">Reports</Link>} />
          <div className="px-3 pt-4 pb-3 sm:px-4">
            {summary.data ? <AmountBars rows={summary.data.trend7} /> : <Skeleton className="h-[220px]" />}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHead title="Latest recharges" right={<Link href="/history" className="text-sm font-medium text-flag hover:underline">All history</Link>} />
          {recent.isLoading && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
          {recent.data?.items.length === 0 && (
            <Empty title="Nothing sent yet today" body="Your recharges show up here as soon as you send them." action={<Link href="/recharge"><Button>New recharge</Button></Link>} />
          )}
          {recent.data && recent.data.items.length > 0 && (
            <ul className="divide-y divide-line">
              {recent.data.items.map((r) => (
                <li key={r.trxid}>
                  <RowButton r={r} onOpen={setOpen} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <RechargeDrawer trxid={open} onClose={() => setOpen(null)} />
    </>
  );
}

function RowButton({ r, onOpen }: { r: Recharge; onOpen: (t: string) => void }) {
  return (
    <button onClick={() => onOpen(r.trxid)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper/60 sm:px-5">
      <OperatorMark op={r.operator} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="tabular font-medium">{fmtPhone(r.number)}</p>
        <p className="truncate text-sm text-muted">
          {timeAgo(r.createdAt)}
          {r.createdBy && typeof r.createdBy === 'object' ? ` · ${r.createdBy.name}` : ''}
        </p>
      </div>
      <span className="tabular w-16 text-right font-semibold">{taka(r.amount)}</span>
      <StatusBadge status={r.status} className="hidden !px-2 !text-xs sm:inline-flex" />
      <StatusDot status={r.status} />
    </button>
  );
}

function StatusDot({ status }: { status: Recharge['status'] }) {
  return <span className="size-2.5 shrink-0 rounded-full sm:hidden" style={{ backgroundColor: statusColor[status] }} aria-label={status} />;
}

function Stat({ label, value, sub, wide }: { label: string; value?: string | null; sub?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 bg-surface px-5 py-4 lg:col-span-1' : 'bg-surface px-5 py-4'}>
      <p className="text-sm text-muted">{label}</p>
      {value == null ? <Skeleton className="mt-2 h-7 w-20" /> : <p className="tabular mt-1 font-display text-2xl font-bold">{value}</p>}
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

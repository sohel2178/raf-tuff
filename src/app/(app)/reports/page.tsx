'use client';

import { AnimatePresence, m } from 'framer-motion';
import { CountUp } from '@/components/motion';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { AmountBars, InlineBar } from '@/components/charts/AmountBars';
import { IconDownload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input, Segmented, Select } from '@/components/ui/field';
import { Empty, ErrorNote, PageHeader, Panel, PanelHead, Skeleton } from '@/components/ui/misc';
import { OperatorMark } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, download } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { dhakaToday, fmtDay, fmtPhone, num, pct, taka } from '@/lib/format';
import { useUrlState } from '@/lib/hooks';
import type { Operator, Totals, User } from '@/lib/types';

type Preset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';
type Range = { from: string; to: string };
type Daily = { range: Range; items: (Totals & { day: string })[] };
type Ops = { range: Range; items: (Totals & { operator: Operator })[] };
type Emps = { range: Range; items: (Totals & { userId: string; name: string; email: string })[] };
type TopRow = { number: string; amount: number; count: number; success: number; operator: Operator };
type Top = { range: Range; byAmount: TopRow[]; byCount: TopRow[] };
type Summary = { range: Range; totals: Totals };

export default function ReportsPage() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const user = useUser();
  const isAdmin = user.role === 'admin';
  const toast = useToast();
  const { get, set } = useUrlState();
  const preset = (get('preset') || 'this_week') as Preset;
  const [customFrom, setCustomFrom] = useState(get('from') || dhakaToday(-6));
  const [customTo, setCustomTo] = useState(get('to') || dhakaToday());
  const employee = get('employee');

  const query = {
    preset,
    ...(preset === 'custom' && { from: get('from') || customFrom, to: get('to') || customTo }),
    ...(isAdmin && employee && { employee }),
  };
  const key = JSON.stringify(query);

  const summary = useQuery({ queryKey: ['rep-summary', key], queryFn: () => api<Summary>('/api/reports/summary', { query }) });
  const daily = useQuery({ queryKey: ['rep-daily', key], queryFn: () => api<Daily>('/api/reports/daily', { query }) });
  const ops = useQuery({ queryKey: ['rep-ops', key], queryFn: () => api<Ops>('/api/reports/operators', { query }) });
  const emps = useQuery({ queryKey: ['rep-emps', key], queryFn: () => api<Emps>('/api/reports/employees', { query }), enabled: isAdmin });
  const top = useQuery({ queryKey: ['rep-top', key], queryFn: () => api<Top>('/api/reports/top-numbers', { query }) });
  const staff = useQuery({ queryKey: ['users'], queryFn: () => api<{ items: User[] }>('/api/users'), enabled: isAdmin, staleTime: 60_000 });

  const csv = (path: string) => () =>
    download(`/api/reports/${path}`, { ...query, format: 'csv' }, `${path}.csv`).catch((e: Error) => toast(e.message, 'error'));

  const t = summary.data?.totals;
  const rangeLabel = summary.data
    ? summary.data.range.from === summary.data.range.to
      ? fmtDay(summary.data.range.from)
      : `${fmtDay(summary.data.range.from)} – ${fmtDay(summary.data.range.to)}`
    : '';

  return (
    <>
      <PageHeader title={isAdmin ? 'Reports' : 'My reports'} sub={rangeLabel ? `${rangeLabel}, Dhaka time` : ' '} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented<Preset>
          label="Date range"
          className="w-full overflow-x-auto lg:w-auto"
          value={preset}
          onChange={(p) => set(p === 'custom' ? { preset: p, from: customFrom, to: customTo } : { preset: p, from: null, to: null })}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'yesterday', label: 'Yesterday' },
            { value: 'this_week', label: 'This week' },
            { value: 'this_month', label: 'This month' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="From" value={customFrom} max={customTo} onChange={(e) => { setCustomFrom(e.target.value); set({ from: e.target.value }); }} className="w-auto" />
            <span className="text-muted">to</span>
            <Input type="date" aria-label="To" value={customTo} min={customFrom} onChange={(e) => { setCustomTo(e.target.value); set({ to: e.target.value }); }} className="w-auto" />
          </div>
        )}
        {isAdmin && (
          <Select aria-label="Staff member" value={employee} onChange={(e) => set({ employee: e.target.value })} className="lg:ml-auto lg:w-56">
            <option value="">All staff</option>
            {staff.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {summary.error && <div className="mt-4"><ErrorNote error={summary.error} retry={() => summary.refetch()} /></div>}

      <section className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
        <Tile label="Amount spent" value={t?.amount} money sub="successful only" strong />
        <Tile label="Successful" value={t?.success} sub={t && `${pct(t.successRate)} of settled`} />
        <Tile label="Failed" value={t?.failed} sub={t && taka(t.failedAmount) + ' not charged'} />
        <Tile label="Cancelled" value={t?.cancel} />
        <Tile label="Still open" value={t && t.processing + t.unknown} sub={t && `${num(t.unknown)} unknown`} />
      </section>

      <Panel className="mt-6">
        <PanelHead title="By day" right={<CsvButton onClick={csv('daily')} />} />
        <div className="px-3 pt-4 sm:px-4">{daily.data ? <AmountBars rows={daily.data.items} height={240} /> : <Skeleton className="h-[240px]" />}</div>
        {daily.data && (
          <div className="mt-2 max-h-[360px] overflow-auto border-t border-line">
            <TotalsTable
              head="Day"
              rows={[...daily.data.items].reverse().map((r) => ({ key: r.day, label: fmtDay(r.day), t: r }))}
              hideEmpty
            />
          </div>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHead title="By operator" right={<CsvButton onClick={csv('operators')} />} />
          {ops.isLoading && <Skeleton className="m-4 h-40" />}
          {ops.data?.items.length === 0 && <Empty title="No recharges in this range" />}
          {ops.data && ops.data.items.length > 0 && (
            <TotalsTable head="Operator" withBar rows={ops.data.items.map((r) => ({ key: r.operator, label: <OperatorMark op={r.operator} size="sm" withName />, t: r }))} />
          )}
        </Panel>

        {isAdmin && (
          <Panel className="overflow-hidden">
            <PanelHead title="By staff member" right={<CsvButton onClick={csv('employees')} />} />
            {emps.isLoading && <Skeleton className="m-4 h-40" />}
            {emps.data?.items.length === 0 && <Empty title="No recharges in this range" />}
            {emps.data && emps.data.items.length > 0 && (
              <TotalsTable
                head="Staff"
                withBar
                rows={emps.data.items.map((r) => ({
                  key: r.userId,
                  label: (
                    <button className="text-left hover:text-flag hover:underline" onClick={() => set({ employee: r.userId })}>
                      {r.name}
                    </button>
                  ),
                  t: r,
                }))}
              />
            )}
          </Panel>
        )}

        <Panel className="overflow-hidden xl:col-span-2">
          <PanelHead title="Top numbers" right={<CsvButton onClick={csv('top-numbers')} />} />
          {top.isLoading && <Skeleton className="m-4 h-40" />}
          {top.data && (
            <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
              <TopList title="By amount" rows={top.data.byAmount} metric={(r) => taka(r.amount)} sub={(r) => `${r.success} successful`} />
              <TopList title="By number of recharges" rows={top.data.byCount} metric={(r) => `${r.success}×`} sub={(r) => taka(r.amount)} />
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function CsvButton({ onClick }: { onClick: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    >
      <IconDownload className="size-4" /> CSV
    </Button>
  );
}

function Tile({ label, value, sub, strong, money }: { label: string; value?: number; sub?: string | null; strong?: boolean; money?: boolean }) {
  return (
    <div className={strong ? 'col-span-2 bg-ink px-5 py-4 text-white md:col-span-1' : 'bg-surface px-5 py-4'}>
      <p className={strong ? 'text-sm text-white/70' : 'text-sm text-muted'}>{label}</p>
      {value == null ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="mt-1 font-display text-2xl font-bold">
          <CountUp value={value} fromZero={strong} format={(v) => (money ? taka(Math.round(v)) : num(Math.round(v)))} />
        </p>
      )}
      {sub && <p className={strong ? 'mt-0.5 text-sm text-white/70' : 'mt-0.5 text-sm text-muted'}>{sub}</p>}
    </div>
  );
}

function TotalsTable({
  head,
  rows,
  withBar,
  hideEmpty,
}: {
  head: string;
  rows: { key: string; label: React.ReactNode; t: Totals }[];
  withBar?: boolean;
  hideEmpty?: boolean;
}) {
  const shown = hideEmpty ? rows.filter((r) => r.t.count > 0) : rows;
  const max = Math.max(0, ...shown.map((r) => r.t.amount));
  if (!shown.length) return <Empty title="No recharges in this range" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-[14.5px] [&_td+td]:pl-4 [&_th+th]:pl-4">
        <thead>
          <tr className="border-b border-line text-sm text-muted">
            <th className="py-2.5 pl-5 font-medium">{head}</th>
            <th className="py-2.5 text-right font-medium">Amount</th>
            {withBar && <th className="w-[18%] py-2.5" />}
            <th className="py-2.5 text-right font-medium">Success</th>
            <th className="py-2.5 text-right font-medium">Failed</th>
            <th className="py-2.5 text-right font-medium">Cancel</th>
            <th className="py-2.5 pr-5 text-right font-medium">Rate</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {shown.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-0">
              <td className="py-2.5 pl-5">{r.label}</td>
              <td className="py-2.5 text-right font-medium">{taka(r.t.amount)}</td>
              {withBar && (
                <td className="py-2.5">
                  <InlineBar value={r.t.amount} max={max} />
                </td>
              )}
              <td className="py-2.5 text-right">{num(r.t.success)}</td>
              <td className="py-2.5 text-right text-muted">{num(r.t.failed)}</td>
              <td className="py-2.5 text-right text-muted">{num(r.t.cancel)}</td>
              <td className="py-2.5 pr-5 text-right">{pct(r.t.successRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopList({ title, rows, metric, sub }: { title: string; rows: TopRow[]; metric: (r: TopRow) => string; sub: (r: TopRow) => string }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <h3 className="mb-2 font-medium text-ink-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-muted">No successful recharges in this range.</p>
      ) : (
        <ol className="divide-y divide-line">
          <AnimatePresence initial={false} mode="popLayout">
          {rows.map((r, i) => (
            <m.li
              key={r.number}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.26 }}
              className="flex items-center gap-3 py-2"
            >
              <span className="tabular w-5 text-right text-sm text-muted">{i + 1}</span>
              <OperatorMark op={r.operator} size="sm" />
              <Link href={`/numbers/${r.number}`} className="tabular flex-1 font-medium hover:text-flag hover:underline">
                {fmtPhone(r.number)}
              </Link>
              <span className="text-right">
                <span className="tabular block font-semibold">{metric(r)}</span>
                <span className="tabular block text-xs text-muted">{sub(r)}</span>
              </span>
            </m.li>
          ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use, useState } from 'react';
import { IconBolt } from '@/components/icons';
import { RechargeDrawer } from '@/components/recharge/RechargeDrawer';
import { CountUp } from '@/components/motion';
import { HistoryLedger } from '@/components/recharge/HistoryLedger';
import { Empty, ErrorNote, Panel, PanelHead, Skeleton } from '@/components/ui/misc';
import { OperatorMark } from '@/components/ui/status';
import { api } from '@/lib/api';
import { OPEN_STATUSES, PHONE_REGEX } from '@/lib/constants';
import { fmtDateTime, fmtPhone, taka } from '@/lib/format';
import type { Operator, Recharge } from '@/lib/types';

type NumberData = {
  number: string;
  summary: {
    count: number;
    successCount: number;
    failedCount: number;
    pendingCount: number;
    totalAmount: number;
    averageAmount: number;
    firstAt: string | null;
    lastAt: string | null;
    lastSuccess: { trxid: string; amount: number; createdAt: string; completedAt: string | null } | null;
    usualOperator: Operator | null;
  };
  items: Recharge[];
};

export default function NumberPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const [open, setOpen] = useState<string | null>(null);
  const valid = PHONE_REGEX.test(number);

  const q = useQuery({
    queryKey: ['number', number],
    queryFn: () => api<NumberData>(`/api/numbers/${number}`),
    enabled: valid,
    refetchInterval: (query) => (query.state.data?.items.some((r) => OPEN_STATUSES.includes(r.status)) ? 10_000 : false),
  });

  if (!valid) return <Empty title="That isn't a valid mobile number" body="Numbers have 11 digits and start with 013–019." />;

  const s = q.data?.summary;
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted">All recharges to</p>
          <h1 className="tabular font-display text-[34px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[40px]">{fmtPhone(number)}</h1>
          {s?.usualOperator && (
            <p className="mt-1">
              <OperatorMark op={s.usualOperator} withName />
            </p>
          )}
        </div>
        <Link
          href={`/recharge?number=${number}`}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-flag px-5 font-medium text-white hover:bg-flag-deep"
        >
          <IconBolt className="size-4" /> Recharge this number
        </Link>
      </div>

      {q.error && <ErrorNote error={q.error} retry={() => q.refetch()} />}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {(
          [
            ['Total topped up', s?.totalAmount, s ? `${s.successCount} successful` : null, true],
            ['Average recharge', s?.averageAmount, 'successful only', true],
            ['Last success', s ? (s.lastSuccess ? s.lastSuccess.amount : 'None yet') : undefined, s?.lastSuccess ? fmtDateTime(s.lastSuccess.completedAt ?? s.lastSuccess.createdAt) : ' ', true],
            ['Attempts', s?.count, s ? `${s.failedCount} failed, ${s.pendingCount} open` : null, false],
          ] as [string, number | string | undefined, string | null, boolean][]
        ).map(([label, value, sub, money]) => (
          <div key={label} className="bg-surface px-4 py-4 sm:px-5">
            <p className="text-sm text-muted">{label}</p>
            {value === undefined ? (
              <Skeleton className="mt-2 h-7 w-24" />
            ) : (
              <p className="mt-1 font-display text-2xl font-bold">
                {typeof value === 'string' ? value : <CountUp value={value} fromZero format={(v) => (money ? taka(Math.round(v)) : String(Math.round(v)))} />}
              </p>
            )}
            <p className="mt-0.5 text-sm text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <Panel className="mt-6 overflow-clip">
        <PanelHead title="Recharges" right={s && <span className="text-sm text-muted">since {fmtDateTime(s.firstAt)}</span>} />
        {q.isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        )}
        {q.data && q.data.items.length === 0 && (
          <Empty title="No recharges to this number yet" action={<Link className="font-medium text-flag hover:underline" href={`/recharge?number=${number}`}>Send the first one</Link>} />
        )}
        {q.data && q.data.items.length > 0 && <HistoryLedger items={q.data.items} page={1} totalPages={1} onOpen={setOpen} linkNumbers={false} />}
      </Panel>
      <RechargeDrawer trxid={open} onClose={() => setOpen(null)} />
    </>
  );
}

'use client';

import { m, useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDay, num, pct, taka } from '@/lib/format';
import type { Totals } from '@/lib/types';

type Row = Totals & { day: string };

const compact = (v: number) => (v >= 10_000 ? `${Math.round(v / 1000)}K` : v.toLocaleString('en-IN'));

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{fmtDay(r.day)}</p>
      <p className="tabular mt-1 flex items-center gap-2">
        <span className="size-2.5 rounded-[3px] bg-chart" aria-hidden />
        <span className="font-semibold">{taka(r.amount)}</span>
        <span className="text-muted">successful</span>
      </p>
      <p className="tabular text-muted">
        {num(r.success)} of {num(r.count)} recharges · {pct(r.successRate)} success
      </p>
      {r.failed + r.cancel > 0 && <p className="tabular text-muted">{num(r.failed + r.cancel)} failed or cancelled</p>}
    </div>
  );
}

/** Single-series column chart of successful amount per day. Title outside names the series (no legend). */
export function AmountBars({ rows, height = 220 }: { rows: Row[]; height?: number }) {
  const reduce = useReducedMotion();
  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeWidth={1} />
            <XAxis
              dataKey="day"
              tickFormatter={fmtDay}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-line-strong)' }}
              tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickFormatter={compact}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip content={<Tip />} cursor={{ fill: 'var(--color-paper)', opacity: 0.8 }} />
            <Bar dataKey="amount" fill="var(--color-chart)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduce} animationDuration={420} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Table view for screen readers */}
      <table className="sr-only">
        <caption>Successful recharge amount per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Successful amount</th>
            <th>Recharges</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <td>{fmtDay(r.day)}</td>
              <td>{taka(r.amount)}</td>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Inline magnitude bar for table cells (single hue). */
export function InlineBar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-r-[4px] bg-paper-2" aria-hidden>
      <m.div className="h-2 rounded-r-[4px] bg-chart" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  );
}

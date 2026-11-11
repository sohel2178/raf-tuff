'use client';

import Link from 'next/link';
import { OperatorMark, StatusBadge } from '@/components/ui/status';
import { creatorName, fmtDateTime, fmtPhone, taka } from '@/lib/format';
import type { Recharge } from '@/lib/types';

/** Table on ≥md, stacked rows on phones. */
export function RechargeList({
  items,
  onOpen,
  showEmployee,
  linkNumbers = true,
}: {
  items: Recharge[];
  onOpen: (trxid: string) => void;
  showEmployee?: boolean;
  linkNumbers?: boolean;
}) {
  return (
    <>
      <table className="hidden w-full text-left text-[14.5px] md:table">
        <thead>
          <tr className="border-b border-line text-sm text-muted">
            <th className="py-2.5 pl-5 font-medium">When</th>
            <th className="py-2.5 font-medium">Number</th>
            <th className="py-2.5 font-medium">Operator</th>
            <th className="py-2.5 pr-6 text-right font-medium">Amount</th>
            <th className="py-2.5 font-medium">Status</th>
            {showEmployee && <th className="py-2.5 font-medium">By</th>}
            <th className="py-2.5 pr-5" />
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr
              key={r.trxid}
              onClick={() => onOpen(r.trxid)}
              className="cursor-pointer border-b border-line last:border-0 hover:bg-paper/60"
            >
              <td className="tabular py-3 pl-5 whitespace-nowrap text-muted">{fmtDateTime(r.createdAt)}</td>
              <td className="tabular py-3 font-medium whitespace-nowrap">
                {linkNumbers ? (
                  <Link href={`/numbers/${r.number}`} onClick={(e) => e.stopPropagation()} className="hover:text-flag hover:underline">
                    {fmtPhone(r.number)}
                  </Link>
                ) : (
                  fmtPhone(r.number)
                )}
              </td>
              <td className="py-3">
                <OperatorMark op={r.operator} size="sm" />
              </td>
              <td className="tabular py-3 pr-6 text-right font-medium">{taka(r.amount)}</td>
              <td className="py-3">
                <StatusBadge status={r.status} />
              </td>
              {showEmployee && <td className="max-w-40 truncate py-3 text-ink-2">{r.source === 'external-api' ? 'API' : creatorName(r.createdBy)}</td>}
              <td className="py-3 pr-5 text-right">
                <button
                  className="text-sm font-medium text-flag hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r.trxid);
                  }}
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden">
        {items.map((r) => (
          <li key={r.trxid}>
            <button onClick={() => onOpen(r.trxid)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-paper">
              <OperatorMark op={r.operator} size="md" />
              <div className="min-w-0 flex-1">
                <p className="tabular font-medium">{fmtPhone(r.number)}</p>
                <p className="truncate text-sm text-muted">
                  {fmtDateTime(r.createdAt)}
                  {showEmployee ? ` · ${r.source === 'external-api' ? 'API' : creatorName(r.createdBy)}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="tabular font-semibold">{taka(r.amount)}</span>
                <StatusBadge status={r.status} className="!px-2 !text-xs" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

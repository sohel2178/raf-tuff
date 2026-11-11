'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';
import { IconRefresh } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ErrorNote, Skeleton } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/overlay';
import { OperatorMark, StatusBadge, statusColor } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { OPEN_STATUSES, STATUS_LABEL } from '@/lib/constants';
import { creatorName, fmtFull, fmtPhone, taka } from '@/lib/format';
import type { Recharge } from '@/lib/types';

const SOURCE: Record<string, string> = {
  api: 'Provider reply',
  poll: 'Status check',
  webhook: 'Operator update',
  system: 'System',
  manual: 'Manual re-check',
};

export function RechargeDrawer({ trxid, onClose }: { trxid: string | null; onClose: () => void }) {
  const user = useUser();
  const qc = useQueryClient();
  const toast = useToast();
  const [showRaw, setShowRaw] = useState(false);

  const q = useQuery({
    queryKey: ['recharge', trxid],
    queryFn: () => api<{ recharge: Recharge }>(`/api/recharges/${trxid}`).then((r) => r.recharge),
    enabled: !!trxid,
    refetchInterval: (query) => (OPEN_STATUSES.includes(query.state.data?.status ?? 'Success') ? 8000 : false),
  });

  const recheck = useMutation({
    mutationFn: () => api<{ changed: boolean; recharge: Recharge }>(`/api/recharges/${trxid}/recheck`, { method: 'POST' }),
    onSuccess: (r) => {
      qc.setQueryData(['recharge', trxid], r.recharge);
      qc.invalidateQueries({ queryKey: ['recharges'] });
      toast(r.changed ? `Status updated: ${STATUS_LABEL[r.recharge.status]}` : 'No change from the provider');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const r = q.data;
  return (
    <Drawer
      open={!!trxid}
      onClose={onClose}
      title={r ? fmtPhone(r.number) : 'Recharge'}
      footer={
        r && (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => recheck.mutate()} loading={recheck.isPending}>
              <IconRefresh className="size-4" /> Re-check status
            </Button>
            <Link
              href={`/recharge?number=${r.number}`}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-flag px-4 text-sm font-medium text-white hover:bg-flag-deep"
            >
              Recharge again
            </Link>
          </div>
        )
      }
    >
      {q.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      )}
      {q.error && <ErrorNote error={q.error} retry={() => q.refetch()} />}
      {r && (
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="tabular font-display text-[32px] leading-none font-extrabold">{taka(r.amount)}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <OperatorMark op={r.operator} size="sm" withName /> <span className="capitalize">· {r.type}</span>
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>
          {r.needsReview && (
            <p className="mt-4 rounded-lg bg-unknown-tint px-3 py-2 text-sm text-unknown">
              No final answer after the polling window. Confirm with the provider before recharging this number again.
            </p>
          )}

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-muted">Reference</dt>
            <dd className="text-right font-mono text-[12.5px] break-all">{r.trxid}</dd>
            {r.providerTxnId && (
              <>
                <dt className="text-muted">Provider ID</dt>
                <dd className="text-right font-mono text-[12.5px] break-all">{r.providerTxnId}</dd>
              </>
            )}
            <dt className="text-muted">Sent by</dt>
            <dd className="text-right">
              {creatorName(r.createdBy)}
              {r.source === 'external-api' && <span className="text-muted"> via API{r.apiKey ? ` (${r.apiKey.name})` : ''}</span>}
            </dd>
            <dt className="text-muted">Created</dt>
            <dd className="tabular text-right">{fmtFull(r.createdAt)}</dd>
            {r.completedAt && (
              <>
                <dt className="text-muted">Finished</dt>
                <dd className="tabular text-right">{fmtFull(r.completedAt)}</dd>
              </>
            )}
            {r.providerMessage && (
              <>
                <dt className="text-muted">Provider says</dt>
                <dd className="text-right">{r.providerMessage}</dd>
              </>
            )}
          </dl>

          <h3 className="mt-8 font-display font-bold">Timeline</h3>
          <ol className="mt-3">
            {(r.statusHistory ?? []).map((h, i, all) => (
              <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                {i < all.length - 1 && <span className="absolute top-4 left-[5px] h-full w-px bg-line-strong" aria-hidden />}
                <span
                  className={clsx('relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-paper')}
                  style={{ backgroundColor: statusColor[h.status] }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">{STATUS_LABEL[h.status]}</span>
                    <span className="tabular text-sm text-muted">{fmtFull(h.at)}</span>
                  </div>
                  <p className="text-sm text-muted">
                    {SOURCE[h.source] ?? h.source}
                    {h.note ? ` — ${h.note}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {user.role === 'admin' && r.rawRechargeResponse != null && (
            <div className="mt-8">
              <button onClick={() => setShowRaw((s) => !s)} className="text-sm font-medium text-flag underline-offset-4 hover:underline">
                {showRaw ? 'Hide' : 'Show'} raw provider response
              </button>
              {showRaw && (
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-ink p-3 font-mono text-xs leading-relaxed text-[#cfe9de]">
                  {JSON.stringify({ rawRechargeResponse: r.rawRechargeResponse, history: r.statusHistory }, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

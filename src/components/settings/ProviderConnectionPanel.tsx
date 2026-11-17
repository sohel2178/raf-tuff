'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, m } from 'framer-motion';
import { useState } from 'react';
import { IconCopy } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Panel, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { API_URL, api } from '@/lib/api';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { unfold } from '@/lib/motion';

type Connection = {
  providerHost: string;
  sandbox: boolean;
  lastIpBlockedAt: string | null;
  lastIpBlockedTrxid: string | null;
  outboundIp: string | null;
};

const isLocalApi = /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(API_URL);

/** Admins: which IP Success TopUp sees from this server, and whether it has been refusing it. */
export function ProviderConnectionPanel() {
  const toast = useToast();
  const info = useQuery({ queryKey: ['provider-connection'], queryFn: () => api<Connection>('/api/provider/connection'), staleTime: 30_000 });
  const [ip, setIp] = useState<string | null>(null);
  const check = useMutation({
    mutationFn: () => api<Connection>('/api/provider/connection/check', { method: 'POST' }),
    onSuccess: (r) => setIp(r.outboundIp),
    onError: (e) => toast(e.message, 'error'),
  });
  const blockedRecently = info.data?.lastIpBlockedAt && Date.now() - new Date(info.data.lastIpBlockedAt).getTime() < 7 * 86_400_000;

  return (
    <Panel className="p-5">
      <h2 className="font-display text-lg font-bold">Provider connection</h2>
      <p className="mt-1 text-muted">
        Success TopUp only accepts recharges from the IPs in its IP Whitelist. The whitelisted IP must be the one this server{' '}
        <em>sends</em> from, which can differ from the IP your domain points to.
      </p>

      {!info.data ? (
        <Skeleton className="mt-4 h-10" />
      ) : (
        <>
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted">Provider</dt>
            <dd className="font-mono text-[13px]">
              {info.data.providerHost}
              {info.data.sandbox ? ' (sandbox)' : ''}
            </dd>
            <dt className="text-muted">API in use</dt>
            <dd className="font-mono text-[13px] break-all">{API_URL}</dd>
          </dl>

          {isLocalApi && (
            <p className="mt-3 rounded-lg bg-marigold-tint px-3 py-2 text-sm text-[#6e5000]" role="status">
              You&apos;re using a backend on this computer. Recharges from here go out from this computer&apos;s IP, not the server&apos;s,
              so Success TopUp will block them unless that IP is whitelisted too.
            </p>
          )}

          {blockedRecently && (
            <p className="mt-3 rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-[#8d1424]" role="alert">
              Success TopUp blocked this server&apos;s IP {timeAgo(info.data.lastIpBlockedAt)} ({fmtDateTime(info.data.lastIpBlockedAt)}).
              {info.data.lastIpBlockedTrxid && (
                <>
                  {' '}
                  Reference <span className="font-mono text-[12.5px]">{info.data.lastIpBlockedTrxid}</span>.
                </>
              )}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => check.mutate()} loading={check.isPending}>
              Check outbound IP
            </Button>
            <span className="text-sm text-muted">Asks api.ipify.org which public IP this server&apos;s requests come from.</span>
          </div>

          <AnimatePresence initial={false}>
            {ip && (
              <m.div key="ip" {...unfold} className="overflow-hidden">
                <div className="mt-4 rounded-lg border-2 border-dashed border-flag bg-flag-tint p-3">
                  <p className="text-sm text-flag-deep">This server connects to Success TopUp from</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="tabular flex-1 font-mono text-xl font-bold text-ink">{ip}</code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(ip).then(() => toast('IP copied'))}
                      className="grid size-9 place-items-center rounded-md text-flag-deep hover:bg-white"
                      aria-label="Copy IP"
                    >
                      <IconCopy />
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-flag-deep">This exact IP must be in your Success TopUp IP Whitelist.</p>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </>
      )}
    </Panel>
  );
}

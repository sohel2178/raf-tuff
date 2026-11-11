'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminOnly } from '@/components/AppShell';
import { IconCopy, IconPlus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Empty, ErrorNote, PageHeader, Panel, Skeleton } from '@/components/ui/misc';
import { Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { API_URL, api } from '@/lib/api';
import { fmtDateTime, taka, timeAgo } from '@/lib/format';
import type { ApiKey } from '@/lib/types';

export default function ApiKeysPage() {
  return (
    <AdminOnly>
      <ApiKeys />
    </AdminOnly>
  );
}

function ApiKeys() {
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ key: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const q = useQuery({ queryKey: ['api-keys'], queryFn: () => api<{ items: ApiKey[] }>('/api/api-keys') });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast('Key revoked');
      setRevoking(null);
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const active = q.data?.items.filter((k) => !k.revokedAt) ?? [];
  const revoked = q.data?.items.filter((k) => k.revokedAt) ?? [];

  return (
    <>
      <PageHeader
        title="API keys"
        sub="Let your other apps read recharge history or send recharges."
        actions={
          <Button onClick={() => setCreating(true)}>
            <IconPlus className="size-4" /> Create key
          </Button>
        }
      />
      {q.error && <ErrorNote error={q.error} retry={() => q.refetch()} />}
      <Panel className="overflow-hidden">
        {q.isLoading && <Skeleton className="m-4 h-32" />}
        {q.data && active.length === 0 && (
          <Empty title="No active keys" body="Create a key for your automation app. You'll see it once, so copy it somewhere safe." />
        )}
        <ul className="divide-y divide-line">
          {active.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{k.name}</p>
                <p className="font-mono text-[12.5px] text-muted">stp_{k.prefix}_••••••••</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {k.scopes.map((s) => (
                  <span key={s} className={s === 'recharge:create' ? 'rounded-full bg-marigold-tint px-2.5 py-0.5 text-[13px] text-[#7a5600]' : 'rounded-full bg-paper-2 px-2.5 py-0.5 text-[13px] text-ink-2'}>
                    {s === 'recharge:create' ? 'Can send recharges' : 'Reads history'}
                  </span>
                ))}
              </div>
              <div className="text-sm text-muted sm:w-44 sm:text-right">
                <p>{k.rechargeLimit != null ? `${taka(k.rechargeLimit)} max per recharge` : k.scopes.includes('recharge:create') ? 'No per-key limit' : ' '}</p>
                <p>{k.ipAllowlist.length ? `${k.ipAllowlist.length} allowed IP${k.ipAllowlist.length > 1 ? 's' : ''}` : 'Any IP'}</p>
              </div>
              <div className="text-sm text-muted sm:w-36 sm:text-right">
                <p>Last used {timeAgo(k.lastUsedAt)}</p>
                <p>Created {fmtDateTime(k.createdAt)}</p>
              </div>
              <Button size="sm" variant="danger" onClick={() => setRevoking(k)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      {revoked.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted">{revoked.length} revoked</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {revoked.map((k) => (
              <li key={k.id}>
                {k.name} <span className="font-mono">stp_{k.prefix}</span> — revoked {fmtDateTime(k.revokedAt)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Panel className="mt-6 p-5">
        <h2 className="font-display font-bold">Using a key</h2>
        <p className="mt-1 text-sm text-muted">Send it in the <code className="font-mono">x-api-key</code> header. Full reference: backend/docs/external-api.md</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-3 font-mono text-[12.5px] leading-relaxed text-[#cfe9de]">
{`curl ${API_URL}/api/v1/external/numbers/01712345678/history \\
  -H "x-api-key: stp_xxxxxxxxxx_..."`}
        </pre>
      </Panel>

      <CreateKey
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(key, name) => {
          setCreating(false);
          setRevealed({ key, name });
        }}
      />

      <Modal open={!!revealed} onClose={() => setRevealed(null)} title="Copy your key now" footer={<Button onClick={() => setRevealed(null)}>I&apos;ve saved it</Button>}>
        <p className="text-muted">This is the only time the key for “{revealed?.name}” is shown. If you lose it, revoke it and create a new one.</p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border-2 border-dashed border-flag bg-flag-tint p-3">
          <code className="flex-1 font-mono text-[13px] break-all">{revealed?.key}</code>
          <button
            onClick={() => navigator.clipboard.writeText(revealed!.key).then(() => toast('Key copied'))}
            className="rounded-md p-2 text-flag-deep hover:bg-white"
            aria-label="Copy key"
          >
            <IconCopy />
          </button>
        </div>
      </Modal>

      <Modal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Revoke this key?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevoking(null)}>
              Keep key
            </Button>
            <Button variant="danger" loading={revoke.isPending} onClick={() => revoking && revoke.mutate(revoking.id)}>
              Revoke key
            </Button>
          </>
        }
      >
        <p className="text-muted">Apps using “{revoking?.name}” stop working immediately. This can’t be undone.</p>
      </Modal>
    </>
  );
}

function CreateKey({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (key: string, name: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [canRecharge, setCanRecharge] = useState(false);
  const [limit, setLimit] = useState('');
  const [ips, setIps] = useState('');
  const m = useMutation({
    mutationFn: () =>
      api<{ key: string; apiKey: ApiKey }>('/api/api-keys', {
        method: 'POST',
        body: {
          name: name.trim(),
          scopes: canRecharge ? ['history:read', 'recharge:create'] : ['history:read'],
          rechargeLimit: limit ? Number(limit) : null,
          ipAllowlist: ips.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      onCreated(r.key, r.apiKey.name);
      setName('');
      setCanRecharge(false);
      setLimit('');
      setIps('');
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create API key"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!name.trim()}>
            Create key
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" hint="Something that tells you which app uses it.">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-recharge bot" />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Permissions</legend>
          <label className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3">
            <input type="checkbox" checked disabled className="mt-1 accent-flag" />
            <span>
              <span className="font-medium">Read history</span>
              <span className="block text-sm text-muted">Number history and recharge status.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3 has-checked:border-marigold">
            <input type="checkbox" checked={canRecharge} onChange={(e) => setCanRecharge(e.target.checked)} className="mt-1 accent-flag" />
            <span>
              <span className="font-medium">Send recharges</span>
              <span className="block text-sm text-muted">Spends your provider balance. Same checks as the web form.</span>
            </span>
          </label>
        </fieldset>
        {canRecharge && (
          <Field label="Max per recharge (৳)" hint="Empty = no per-key limit">
            <Input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        <Field label="Allowed IP addresses" hint="One per line or comma-separated. Empty = any IP.">
          <textarea
            value={ips}
            onChange={(e) => setIps(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-sm focus:border-flag focus:ring-3 focus:ring-flag/15 focus:outline-none"
            placeholder="203.0.113.10"
          />
        </Field>
        {m.error && <p className="text-sm text-danger">{m.error.message}</p>}
      </div>
    </Modal>
  );
}

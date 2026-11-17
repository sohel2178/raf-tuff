'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { BulkPacePanel } from '@/components/bulk/BulkPacePanel';
import { ProviderConnectionPanel } from '@/components/settings/ProviderConnectionPanel';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { PageHeader, Panel } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { api, tokenStore } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { taka } from '@/lib/format';
import type { User } from '@/lib/types';

export default function SettingsPage() {
  const user = useUser();
  const { setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);

  const apply = (r: { user: User; accessToken: string }) => {
    tokenStore.set(r.accessToken);
    setUser(r.user);
  };

  const saveName = useMutation({
    mutationFn: () => api<{ user: User; accessToken: string }>('/api/auth/me', { method: 'PATCH', body: { name: name.trim() } }),
    onSuccess: (r) => {
      apply(r);
      toast('Name updated');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const savePw = useMutation({
    mutationFn: () => api<{ user: User; accessToken: string }>('/api/auth/me', { method: 'PATCH', body: { currentPassword: current, newPassword: next } }),
    onSuccess: (r) => {
      apply(r);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password changed. Other devices were signed out.');
    },
    onError: (e) => setPwErr(e.message),
  });

  const submitPw = (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    if (next.length < 8) return setPwErr('New password needs at least 8 characters');
    if (next !== confirm) return setPwErr('The new passwords don’t match');
    savePw.mutate();
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" sub={user.email} />

      <Panel className="p-5">
        <h2 className="font-display text-lg font-bold">Your limits</h2>
        {user.role === 'admin' ? (
          <p className="mt-1 text-muted">You&apos;re an admin, so there&apos;s no limit on your recharges.</p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted">Per recharge</dt>
              <dd className="tabular font-display text-2xl font-bold">{taka(user.rechargeLimit)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Per day</dt>
              <dd className="tabular font-display text-2xl font-bold">{user.dailyLimit != null ? taka(user.dailyLimit) : 'No cap'}</dd>
            </div>
            <p className="col-span-2 text-sm text-muted">Only an admin can change these.</p>
          </dl>
        )}
      </Panel>

      <Panel className="mt-5 p-5">
        <h2 className="font-display text-lg font-bold">Recharge PIN</h2>
        <p className="mt-1 text-muted">
          Every recharge asks for the shop&apos;s 6-digit PIN before it&apos;s sent. Five wrong tries lock recharging for 15 minutes.
        </p>
        <p className="mt-3 text-sm">
          {user.rechargePinConfigured === false ? (
            <span className="rounded-md bg-marigold-tint px-2 py-1 text-[#6e5000]">
              Not set — recharges are paused.{user.role === 'admin' ? ' Add RECHARGE_PIN to the backend .env and restart the API.' : ' Ask your admin.'}
            </span>
          ) : user.role === 'admin' ? (
            <span className="text-muted">Set on the server as RECHARGE_PIN in the backend .env. Change it there and restart the API.</span>
          ) : (
            <span className="text-muted">Set by your admin. Ask them if you don&apos;t know it.</span>
          )}
        </p>
      </Panel>

      {user.role === 'admin' && (
        <div className="mt-5">
          <BulkPacePanel />
          <div className="mt-5">
            <ProviderConnectionPanel />
          </div>
        </div>
      )}

      <Panel className="mt-5 p-5">
        <h2 className="font-display text-lg font-bold">Profile</h2>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== user.name) saveName.mutate();
          }}
        >
          <Field label="Name" className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" loading={saveName.isPending} disabled={!name.trim() || name.trim() === user.name}>
            Save name
          </Button>
        </form>
      </Panel>

      <Panel className="mt-5 p-5">
        <h2 className="font-display text-lg font-bold">Change password</h2>
        <form className="mt-3 flex flex-col gap-4" onSubmit={submitPw}>
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" hint="At least 8 characters">
              <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Repeat new password">
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
          {pwErr && <p className="text-sm text-danger">{pwErr}</p>}
          <div>
            <Button type="submit" loading={savePw.isPending} disabled={!current || !next}>
              Change password
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

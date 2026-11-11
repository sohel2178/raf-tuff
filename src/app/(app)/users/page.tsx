'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AdminOnly } from '@/components/AppShell';
import { IconPlus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, Input, Segmented } from '@/components/ui/field';
import { Empty, ErrorNote, PageHeader, Panel, Skeleton } from '@/components/ui/misc';
import { Drawer, Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { taka, timeAgo } from '@/lib/format';
import type { Role, User } from '@/lib/types';

export default function UsersPage() {
  return (
    <AdminOnly>
      <Users />
    </AdminOnly>
  );
}

type Tab = 'employee' | 'admin';

function Users() {
  const [creating, setCreating] = useState<Role | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('employee');
  const [showInactive, setShowInactive] = useState(false);
  const q = useQuery({ queryKey: ['users'], queryFn: () => api<{ items: User[] }>('/api/users') });
  const all = q.data?.items ?? [];
  const count = (r: Role) => all.filter((u) => u.role === r && u.active).length;
  const inTab = all.filter((u) => u.role === tab);
  const items = inTab.filter((u) => showInactive || u.active);
  const inactiveCount = inTab.filter((u) => !u.active).length;

  return (
    <>
      <PageHeader
        title="Users"
        sub="Employees send recharges within their limits. Admins manage users, keys and reports."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreating('admin')}>
              Add admin
            </Button>
            <Button onClick={() => setCreating('employee')}>
              <IconPlus className="size-4" /> Add employee
            </Button>
          </>
        }
      />
      {q.error && <ErrorNote error={q.error} retry={() => q.refetch()} />}

      <div role="tablist" aria-label="User type" className="mb-3 flex gap-6 border-b border-line">
        {(
          [
            ['employee', 'Employees'],
            ['admin', 'Admins'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={clsx(
              '-mb-px flex items-center gap-2 border-b-2 pb-2.5 font-medium transition-colors',
              tab === value ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {label}
            <span className={clsx('tabular rounded-full px-2 text-xs leading-5', tab === value ? 'bg-ink text-white' : 'bg-paper-2 text-muted')}>
              {q.data ? count(value) : '·'}
            </span>
          </button>
        ))}
      </div>

      <Panel className="overflow-hidden">
        {q.isLoading && <Skeleton className="m-4 h-40" />}
        {q.data && items.length === 0 && (
          <Empty
            title={tab === 'employee' ? 'No employees yet' : 'No other admins'}
            body={
              tab === 'employee'
                ? 'Add the people who send recharges. Each gets their own login and a per-recharge limit (৳50 to start).'
                : 'Admins have no recharge limit and can manage everything.'
            }
            action={
              <Button onClick={() => setCreating(tab)}>
                <IconPlus className="size-4" /> {tab === 'employee' ? 'Add your first employee' : 'Add admin'}
              </Button>
            }
          />
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-line">
            {items.map((u) => (
              <li key={u.id}>
                <button onClick={() => setEditing(u)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-paper/60 sm:px-5">
                  <span
                    className={clsx(
                      'grid size-10 shrink-0 place-items-center rounded-full font-display font-bold',
                      u.role === 'admin' ? 'bg-ink text-white' : 'bg-flag-tint text-flag-deep',
                      !u.active && 'opacity-40',
                    )}
                    aria-hidden
                  >
                    {u.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {u.name} {!u.active && <span className="ml-1 rounded bg-cancel-tint px-1.5 py-0.5 text-xs text-cancel">Deactivated</span>}
                    </p>
                    <p className="truncate text-sm text-muted">{u.email}</p>
                  </div>
                  <div className="hidden text-right text-sm sm:block">
                    <p className="text-muted">Last sign-in</p>
                    <p>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</p>
                  </div>
                  <div className="w-28 shrink-0 text-right sm:w-32">
                    {u.role === 'admin' ? (
                      <p className="text-sm text-muted">No limit</p>
                    ) : (
                      <>
                        <p className="tabular font-medium">{taka(u.rechargeLimit)} each</p>
                        <p className="tabular text-sm text-muted">{u.dailyLimit != null ? `${taka(u.dailyLimit)} a day` : 'No daily cap'}</p>
                      </>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {inactiveCount > 0 && (
        <button onClick={() => setShowInactive((v) => !v)} className="mt-3 text-sm font-medium text-flag hover:underline">
          {showInactive ? 'Hide' : 'Show'} {inactiveCount} deactivated
        </button>
      )}
      <CreateUser key={creating ?? 'closed'} open={!!creating} initialRole={creating ?? 'employee'} onClose={() => setCreating(null)} />
      {editing && <EditUser user={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const limitField = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+$/.test(v), 'Whole taka only');

const createSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  rechargeLimit: limitField,
  dailyLimit: limitField,
});

function CreateUser({ open, onClose, initialRole }: { open: boolean; onClose: () => void; initialRole: Role }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [role, setRole] = useState<Role>(initialRole);
  const { register, handleSubmit, reset, setError, formState } = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { rechargeLimit: '50', dailyLimit: '' },
  });
  const m = useMutation({
    mutationFn: (b: z.infer<typeof createSchema>) =>
      api<{ user: User }>('/api/users', {
        method: 'POST',
        body: {
          name: b.name,
          email: b.email,
          password: b.password,
          role,
          ...(role === 'employee' && {
            rechargeLimit: Number(b.rechargeLimit || 50),
            dailyLimit: b.dailyLimit ? Number(b.dailyLimit) : null,
          }),
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast(`${r.user.name} added`);
      reset();
      onClose();
    },
    onError: (e) => setError('root', { message: e.message }),
  });
  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={role === 'admin' ? 'Add admin' : 'Add employee'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-user" type="submit" loading={m.isPending}>
            {role === 'admin' ? 'Add admin' : 'Add employee'}
          </Button>
        </>
      }
    >
      <form id="create-user" onSubmit={handleSubmit((b) => m.mutate(b))} className="flex flex-col gap-4" noValidate>
        <Segmented<Role> label="Role" value={role} onChange={setRole} options={[{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }]} />
        <Field label="Name" error={e.name?.message}>
          <Input autoFocus {...register('name')} />
        </Field>
        <Field label="Email" error={e.email?.message}>
          <Input type="email" autoComplete="off" {...register('email')} />
        </Field>
        <Field label="Password for first sign-in" hint="Share it privately. They can change it in Settings." error={e.password?.message}>
          <Input type="text" autoComplete="new-password" {...register('password')} />
        </Field>
        {role === 'employee' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Per recharge (৳)" error={e.rechargeLimit?.message}>
              <Input inputMode="numeric" {...register('rechargeLimit')} />
            </Field>
            <Field label="Per day (৳)" hint="Empty = no cap" error={e.dailyLimit?.message}>
              <Input inputMode="numeric" {...register('dailyLimit')} />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-muted">Admins have no recharge limit and can manage staff and API keys.</p>
        )}
        {e.root && <p className="text-sm text-danger">{e.root.message}</p>}
      </form>
    </Modal>
  );
}

function EditUser({ user, onClose }: { user: User; onClose: () => void }) {
  const me = useUser();
  const self = me.id === user.id;
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);
  const [limit, setLimit] = useState(String(user.rechargeLimit ?? 50));
  const [daily, setDaily] = useState(user.dailyLimit == null ? '' : String(user.dailyLimit));
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const done = (msg: string) => {
    qc.invalidateQueries({ queryKey: ['users'] });
    toast(msg);
  };
  const onError = (e: Error) => setErr(e instanceof ApiError ? e.message : 'Could not save');

  const save = useMutation({
    mutationFn: async () => {
      setErr(null);
      const profile: Record<string, unknown> = {};
      if (name !== user.name) profile.name = name;
      if (email !== user.email) profile.email = email;
      if (role !== user.role) profile.role = role;
      if (Object.keys(profile).length) await api(`/api/users/${user.id}`, { method: 'PATCH', body: profile });
      if (role === 'employee') {
        if (!/^\d+$/.test(limit)) throw new ApiError(400, 'BAD', 'Per-recharge limit must be a whole number');
        if (daily && !/^\d+$/.test(daily)) throw new ApiError(400, 'BAD', 'Daily limit must be a whole number or empty');
        const nextDaily = daily ? Number(daily) : null;
        if (Number(limit) !== user.rechargeLimit || nextDaily !== user.dailyLimit || role !== user.role)
          await api(`/api/users/${user.id}/limit`, { method: 'PATCH', body: { rechargeLimit: Number(limit), dailyLimit: nextDaily } });
      }
    },
    onSuccess: () => {
      done('Changes saved');
      onClose();
    },
    onError,
  });
  const toggleActive = useMutation({
    mutationFn: () => api(`/api/users/${user.id}`, { method: 'PATCH', body: { active: !user.active } }),
    onSuccess: () => {
      done(user.active ? `${user.name} deactivated` : `${user.name} reactivated`);
      onClose();
    },
    onError,
  });
  const resetPw = useMutation({
    mutationFn: () => api(`/api/users/${user.id}/reset-password`, { method: 'POST', body: { password: pw } }),
    onSuccess: () => {
      setPw('');
      done('Password reset. They have been signed out everywhere.');
    },
    onError,
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title={user.name}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => save.mutate()} loading={save.isPending}>
            Save changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Role</p>
          <Segmented<Role>
            label="Role"
            value={role}
            onChange={(r) => !self && setRole(r)}
            options={[{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }]}
          />
          {self && <p className="mt-1.5 text-sm text-muted">You can&apos;t change your own role.</p>}
        </div>
        {role === 'employee' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Per recharge (৳)">
              <Input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Per day (৳)" hint="Empty = no cap">
              <Input inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
        )}
        {err && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-[#8d1424]">{err}</p>}

        <div className="mt-4 border-t border-line pt-5">
          <h3 className="font-display font-bold">Reset password</h3>
          <p className="mt-1 text-sm text-muted">Signs them out on every device.</p>
          <div className="mt-3 flex gap-2">
            <Input type="text" placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            <Button variant="secondary" disabled={pw.length < 8} loading={resetPw.isPending} onClick={() => resetPw.mutate()}>
              Reset
            </Button>
          </div>
        </div>

        {!self && (
          <div className="mt-4 border-t border-line pt-5">
            <h3 className="font-display font-bold">{user.active ? 'Deactivate account' : 'Reactivate account'}</h3>
            <p className="mt-1 text-sm text-muted">
              {user.active ? 'They are signed out immediately and can’t sign in. Their history stays.' : 'They can sign in again with their current password.'}
            </p>
            <Button variant={user.active ? 'danger' : 'secondary'} className="mt-3" loading={toggleActive.isPending} onClick={() => toggleActive.mutate()}>
              {user.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

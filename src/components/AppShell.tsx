'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth, useUser } from '@/lib/auth';
import { taka } from '@/lib/format';
import { IconBolt, IconChart, IconCog, IconHome, IconKey, IconList, IconLogout, IconMore, IconUsers } from './icons';
import { Drawer } from './ui/overlay';

type Item = { href: string; label: string; icon: React.FC<{ className?: string }>; admin?: boolean };

const NAV: Item[] = [
  { href: '/dashboard', label: 'Today', icon: IconHome },
  { href: '/recharge', label: 'New recharge', icon: IconBolt },
  { href: '/history', label: 'History', icon: IconList },
  { href: '/reports', label: 'Reports', icon: IconChart },
  { href: '/users', label: 'Users', icon: IconUsers, admin: true },
  { href: '/api-keys', label: 'API keys', icon: IconKey, admin: true },
  { href: '/settings', label: 'Settings', icon: IconCog },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(href + '/');

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx('font-display font-extrabold tracking-[-0.03em]', className)}>
      Sultan<span className="text-flag">TopUp</span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const { logout } = useAuth();
  const path = usePathname();
  const [more, setMore] = useState(false);
  const items = NAV.filter((i) => !i.admin || user.role === 'admin');

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper px-3 py-5 lg:flex">
        <Link href="/dashboard" className="px-3 text-xl">
          <Wordmark />
        </Link>
        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Main">
          {items.map((i) => {
            const active = isActive(path, i.href);
            const primary = i.href === '/recharge';
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors',
                  primary && !active && 'text-flag',
                  active ? 'bg-ink text-white' : 'text-ink-2 hover:bg-paper-2',
                )}
              >
                <i.icon className="size-[18px]" />
                {i.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-line px-3 pt-4">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted">
            {user.role === 'admin' ? 'Admin · no limit' : `Limit ${taka(user.rechargeLimit)} per recharge`}
          </p>
          <button onClick={logout} className="mt-3 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <IconLogout className="size-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="text-lg">
          <Wordmark />
        </Link>
        <span className="max-w-[50%] truncate text-sm text-muted">{user.name}</span>
      </header>

      <main className="min-w-0 px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <Tab href="/dashboard" label="Today" icon={IconHome} active={isActive(path, '/dashboard')} />
        <Tab href="/history" label="History" icon={IconList} active={isActive(path, '/history')} />
        <Link
          href="/recharge"
          aria-current={isActive(path, '/recharge') ? 'page' : undefined}
          className="flex flex-col items-center gap-1 pb-2"
        >
          <span
            className={clsx(
              '-mt-5 grid size-14 place-items-center rounded-full text-white shadow-[0_6px_16px_-4px_rgba(0,81,59,0.55)] ring-4 ring-surface',
              isActive(path, '/recharge') ? 'bg-flag-deep' : 'bg-flag',
            )}
          >
            <IconBolt className="size-6" />
          </span>
          <span className="text-[11px] font-medium text-flag">Recharge</span>
        </Link>
        <Tab href="/reports" label="Reports" icon={IconChart} active={isActive(path, '/reports')} />
        <button onClick={() => setMore(true)} className="flex h-16 flex-col items-center justify-center gap-1 text-muted">
          <IconMore className="size-[22px]" />
          <span className="text-[11px] font-medium">More</span>
        </button>
      </nav>

      <Drawer open={more} onClose={() => setMore(false)} title={user.name}>
        <div className="flex flex-col gap-1">
          {items
            .filter((i) => ['/users', '/api-keys', '/settings'].includes(i.href))
            .map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setMore(false)}
                className="flex h-12 items-center gap-3 rounded-lg px-3 font-medium hover:bg-paper-2"
              >
                <i.icon /> {i.label}
              </Link>
            ))}
          <button onClick={logout} className="flex h-12 items-center gap-3 rounded-lg px-3 font-medium text-danger hover:bg-danger-tint">
            <IconLogout /> Log out
          </button>
        </div>
      </Drawer>
    </div>
  );
}

function Tab({ href, label, icon: I, active }: { href: string; label: string; icon: React.FC<{ className?: string }>; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx('flex h-16 flex-col items-center justify-center gap-1', active ? 'text-ink' : 'text-muted')}
    >
      <I className="size-[22px]" />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}

/** Wrap admin-only pages. Employees get a clear message instead of a broken page. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const user = useUser();
  if (user.role !== 'admin')
    return (
      <div className="py-20 text-center">
        <p className="font-display text-xl font-bold">This page is for admins</p>
        <p className="mt-1 text-muted">Ask an admin if you need access.</p>
        <Link href="/dashboard" className="mt-4 inline-block font-medium text-flag underline-offset-4 hover:underline">
          Back to today
        </Link>
      </div>
    );
  return <>{children}</>;
}

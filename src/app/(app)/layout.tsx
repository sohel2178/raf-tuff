'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell, Wordmark } from '@/components/AppShell';
import { useAuth } from '@/lib/auth';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (status === 'guest') router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [status, router, path]);

  if (status !== 'authed')
    return (
      <div className="grid min-h-dvh place-items-center">
        <Wordmark className="animate-pulse-soft text-2xl" />
      </div>
    );
  return <AppShell>{children}</AppShell>;
}

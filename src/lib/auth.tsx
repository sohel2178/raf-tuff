'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, tokenStore } from './api';
import type { User } from './types';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authed'; user: User }
  | { status: 'guest'; user: null };

type AuthCtx = AuthState & {
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    tokenStore.onAuthLost(() => {
      tokenStore.set(null);
      qc.clear();
      setState({ status: 'guest', user: null });
    });
    refreshSession().then((r) => setState(r ? { status: 'authed', user: r.user } : { status: 'guest', user: null }));
  }, [qc]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ accessToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      noRefresh: true,
    });
    tokenStore.set(r.accessToken);
    setState({ status: 'authed', user: r.user });
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST', noRefresh: true }).catch(() => undefined);
    tokenStore.set(null);
    qc.clear();
    setState({ status: 'guest', user: null });
    router.replace('/login');
  }, [qc, router]);

  const setUser = useCallback((u: User) => setState({ status: 'authed', user: u }), []);

  const value = useMemo(() => ({ ...state, login, logout, setUser }), [state, login, logout, setUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

/** For pages inside the authed shell — user is guaranteed. */
export function useUser() {
  const { user } = useAuth();
  if (!user) throw new Error('useUser used outside an authed route');
  return user;
}

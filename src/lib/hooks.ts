'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** URL search params as state (filters survive reload and can be shared). */
export function useUrlState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const get = useCallback((k: string) => sp.get(k) ?? '', [sp]);
  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, opts: { resetPage?: boolean } = { resetPage: true }) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, String(v));
      }
      if (opts.resetPage && !('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );
  return { get, set, params: sp };
}

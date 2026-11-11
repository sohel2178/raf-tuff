export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  /** zod-flattened field errors from VALIDATION_ERROR responses */
  get fieldErrors(): Record<string, string[]> {
    const d = this.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return d?.fieldErrors ?? {};
  }
}

// ── access token (memory only; refresh token lives in an httpOnly cookie) ──
let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;
export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null) => {
    accessToken = t;
  },
  onAuthLost: (fn: () => void) => {
    onAuthLost = fn;
  },
};

type RefreshResult = { accessToken: string; user: import('./types').User } | null;
let refreshing: Promise<RefreshResult> | null = null;

/** Single-flight refresh: concurrent 401s share one /refresh call. */
export function refreshSession(): Promise<RefreshResult> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const data = (await res.json()) as NonNullable<RefreshResult>;
      accessToken = data.accessToken;
      return data;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown; query?: Record<string, unknown>; noRefresh?: boolean };

export function buildQuery(q?: Record<string, unknown>) {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(','));
    } else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function rawFetch(path: string, { body, query, headers, noRefresh, ...init }: Options = {}, retried = false): Promise<Response> {
  const res = await fetch(`${API_URL}${path}${buildQuery(query)}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !noRefresh && !retried) {
    const r = await refreshSession();
    if (r) return rawFetch(path, { body, query, headers, noRefresh, ...init }, true);
    onAuthLost?.();
  }
  return res;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await rawFetch(path, opts);
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const e = (data as { error?: { code: string; message: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(res.status, e?.code ?? 'HTTP_ERROR', e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  return data as T;
}

/** Authenticated file download (CSV exports). */
export async function download(path: string, query?: Record<string, unknown>, fallbackName = 'export.csv') {
  const res = await rawFetch(path, { query, headers: { Accept: 'text/csv' } });
  if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', `Export failed (${res.status})`);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const name = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const newIdempotencyKey = () =>
  `web-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(2)).join('')}`;

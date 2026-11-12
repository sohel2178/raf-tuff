const TZ = 'Asia/Dhaka';

const money0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
/** ৳1,25,000 — South-Asian digit grouping. */
export const taka = (n: number | null | undefined) => (n == null ? '—' : `৳${money0.format(n)}`);
export const num = (n: number | null | undefined) => (n == null ? '—' : money0.format(n));

const dt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
const dtFull = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const timeOnly = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const fmtDateTime = (s?: string | Date | null) => (s ? dt.format(new Date(s)) : '—');
export const fmtFull = (s?: string | Date | null) => (s ? dtFull.format(new Date(s)) : '—');
/** '8:11 pm' */
export const fmtClock = (s?: string | Date | null) => (s ? clock.format(new Date(s)) : '—');
export const fmtTime = (s?: string | Date | null) => (s ? timeOnly.format(new Date(s)) : '—');
/** 'yyyy-MM-dd' → '4 Nov' */
export const fmtDay = (d: string) => dayFmt.format(new Date(`${d}T12:00:00+06:00`));
/** Today in Dhaka as yyyy-MM-dd */
export const dhakaToday = (offsetDays = 0) => dayKey.format(new Date(Date.now() + offsetDays * 86400_000));
/** Dhaka calendar day of a timestamp, as yyyy-MM-dd */
export const dhakaDayKey = (s: string | Date) => dayKey.format(new Date(s));
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' });
/** 'yyyy-MM-dd' → { name: 'Today' | 'Yesterday' | 'Tue', date: '10 Nov' } */
export function dayLabel(key: string) {
  const date = fmtDay(key);
  if (key === dhakaToday()) return { name: 'Today', date };
  if (key === dhakaToday(-1)) return { name: 'Yesterday', date };
  return { name: weekdayFmt.format(new Date(`${key}T12:00:00+06:00`)), date };
}

export function timeAgo(s?: string | null) {
  if (!s) return '—';
  const sec = Math.round((Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  return fmtDateTime(s);
}

/** 01712345678 → 017 1234 5678 */
export function fmtPhone(n: string) {
  const d = n.replace(/\D/g, '');
  return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11)].filter(Boolean).join(' ');
}

export const pct = (n: number | null | undefined) => (n == null ? '—' : `${n}%`);

export const creatorName = (c: unknown) =>
  c && typeof c === 'object' && 'name' in c ? String((c as { name: string }).name) : '—';

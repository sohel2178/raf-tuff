'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, m } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BatchStatus } from '@/components/bulk/batchStatus';
import { fmtGap, useBulkPace } from '@/components/bulk/BulkPacePanel';
import { IconDownload, IconPlus, IconTrash, IconUpload } from '@/components/icons';
import { CountUp, ShakeOn } from '@/components/motion';
import { PinPad } from '@/components/recharge/PinPad';
import { type LastDone, type RepeatRow, RepeatWarningBulk, lastDoneLine } from '@/components/recharge/RepeatWarning';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/field';
import { Empty, PageHeader, Panel, PanelHead } from '@/components/ui/misc';
import { Modal } from '@/components/ui/overlay';
import { OperatorMark } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { BULK_MAX, type BulkRow, newRow, parseCells, parseText, rowError } from '@/lib/bulkParse';
import { OPERATORS, OPERATOR_BY_CODE, isRecentRepeat } from '@/lib/constants';
import { cleanNumber, creatorName, dhakaDayKey, dhakaToday, fmtClock, fmtDateTime, fmtPhone, taka, timeAgo } from '@/lib/format';
import { EASE_OUT, dur, unfold } from '@/lib/motion';
import type { BulkBatch, BulkSummary, Operator, RechargeStatus, RechargeType, Totals } from '@/lib/types';

type Mode = 'type' | 'paste' | 'excel';
type Last = { number: string; amount: number; status: RechargeStatus; createdAt: string; createdBy: { name?: string }; lastDone: LastDone | null };
const DRAFT_KEY = 'stp-bulk-draft';

/** Rows survive a reload or a trip to another page (per tab); "Retry failed" also hands rows over this way. */
function loadDraft(): BulkRow[] {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as BulkRow[]) : [];
  } catch {
    return [];
  }
}
function saveDraft(rows: BulkRow[]) {
  try {
    if (rows.length) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(rows));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable: the draft just won't survive a reload */
  }
}

export default function BulkPage() {
  const user = useUser();
  const toast = useToast();
  const isAdmin = user.role === 'admin';
  const limit = isAdmin ? null : (user.rechargeLimit ?? 0);

  const [mode, setMode] = useState<Mode>('type');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setRows(loadDraft());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) saveDraft(rows);
  }, [rows, hydrated]);

  const add = (incoming: BulkRow[], skipped = 0) => {
    const room = BULK_MAX - rows.length;
    const taken = incoming.slice(0, Math.max(0, room));
    if (taken.length) setRows((r) => [...r, ...taken]);
    const dropped = incoming.length - taken.length;
    const parts = [
      taken.length ? `Added ${taken.length} number${taken.length === 1 ? '' : 's'}` : 'Nothing added',
      skipped ? `skipped ${skipped} line${skipped === 1 ? '' : 's'} that weren't numbers` : '',
      dropped ? `${dropped} over the ${BULK_MAX}-number limit left out` : '',
    ].filter(Boolean);
    toast(parts.join(', '), taken.length ? 'ok' : 'error');
    return taken.length;
  };
  const update = (key: string, patch: Partial<BulkRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  // Last recharge (from anyone) for every valid number, to flag repeats
  const validNumbers = useMemo(() => [...new Set(rows.filter((r) => /^01[3-9]\d{8}$/.test(r.number)).map((r) => r.number))].sort(), [rows]);
  const last = useQuery({
    queryKey: ['numbers-last', validNumbers],
    queryFn: () => api<{ items: Last[] }>('/api/numbers/last', { method: 'POST', body: { numbers: validNumbers } }),
    enabled: validNumbers.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const lastBy = useMemo(() => new Map((last.data?.items ?? []).map((l) => [l.number, l])), [last.data]);
  // Employees: the lookup must match the current list before sending, so the 28-day check can't be skipped
  const checking = !isAdmin && validNumbers.length > 0 && (last.isFetching || last.isPlaceholderData || !last.data);
  const recentRepeat = (n: string) => !isAdmin && isRecentRepeat(lastBy.get(n)?.lastDone);

  const [repeatRows, setRepeatRows] = useState<RepeatRow[]>([]);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const startSend = () => {
    const flagged = rows
      .filter((r) => recentRepeat(r.number))
      .map((r) => ({ key: r.key, number: r.number, amount: r.amount, last: lastBy.get(r.number)!.lastDone! }));
    if (flagged.length) {
      setRepeatRows(flagged);
      setRepeatOpen(true);
    } else setConfirming(true);
  };

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of rows) c.set(r.number, (c.get(r.number) ?? 0) + 1);
    return c;
  }, [rows]);
  const errors = rows.map((r) => rowError(r, limit));
  const errorCount = errors.filter(Boolean).length;
  const dupeCount = rows.filter((r) => (counts.get(r.number) ?? 0) > 1).length;
  const total = rows.reduce((s, r) => s + (r.amount && Number.isFinite(r.amount) ? r.amount : 0), 0);

  // Money context: admins see the provider balance, employees what's left of a daily cap
  const balance = useQuery({
    queryKey: ['balance'],
    queryFn: () => api<{ balance: number | null }>('/api/provider/balance'),
    enabled: isAdmin,
    retry: false,
    staleTime: 30_000,
  });
  const today = useQuery({
    queryKey: ['summary', 'today'],
    queryFn: () => api<{ totals: Totals }>('/api/reports/summary', { query: { preset: 'today' } }),
    enabled: !isAdmin && user.dailyLimit != null,
  });
  const leftToday =
    user.dailyLimit != null && today.data ? Math.max(0, user.dailyLimit - today.data.totals.amount - today.data.totals.pendingAmount) : null;

  const recent = useQuery({ queryKey: ['bulk-list'], queryFn: () => api<{ items: BulkSummary[] }>('/api/bulk'), staleTime: 10_000 });

  return (
    <>
      <PageHeader
        title="Bulk recharge"
        sub={`Add up to ${BULK_MAX} numbers, check them, then send them as one batch. It keeps going if you close this page.`}
      />

      <Panel className="p-4 sm:p-5">
        <Segmented<Mode>
          label="How to add numbers"
          className="w-full"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'type', label: 'Type' },
            { value: 'paste', label: 'Paste' },
            { value: 'excel', label: 'Excel' },
          ]}
        />
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: -4, transition: { duration: dur.fast } }}
            className="mt-4"
          >
            {mode === 'type' && <TypeInput onAdd={(r) => add([r])} full={rows.length >= BULK_MAX} />}
            {mode === 'paste' && <PasteInput onAdd={add} />}
            {mode === 'excel' && <ExcelInput onAdd={add} />}
          </m.div>
        </AnimatePresence>
      </Panel>

      <AnimatePresence initial={false}>
        {rows.length > 0 && (
          <m.div key="review" {...unfold} className="overflow-hidden">
            <Panel className="mt-5 overflow-clip">
              <PanelHead
                title={`Review (${rows.length})`}
                right={
                  <button onClick={() => setRows([])} className="text-sm font-medium text-muted hover:text-danger">
                    Clear list
                  </button>
                }
              />
              <ul>
                <AnimatePresence initial={false} mode="popLayout">
                  {rows.map((r, i) => (
                    <ReviewRow
                      key={r.key}
                      index={i}
                      row={r}
                      error={errors[i] ?? null}
                      duplicate={(counts.get(r.number) ?? 0) > 1}
                      last={lastBy.get(r.number)}
                      recentRepeat={recentRepeat(r.number)}
                      onChange={(p) => update(r.key, p)}
                      onRemove={() => remove(r.key)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </Panel>
          </m.div>
        )}
      </AnimatePresence>

      {/* Totals + send: sticks above the mobile tab bar */}
      <div className="sticky bottom-[76px] z-20 -mx-4 mt-5 bg-gradient-to-t from-paper from-75% to-transparent px-4 pt-4 pb-2 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-4">
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="flex flex-1 flex-wrap items-baseline gap-x-5 gap-y-1">
            <p>
              <CountUp value={rows.length} className="font-display text-2xl font-bold" />{' '}
              <span className="text-muted">number{rows.length === 1 ? '' : 's'}</span>
            </p>
            <p>
              <CountUp value={total} format={(v) => taka(Math.round(v))} className="font-display text-2xl font-bold" />{' '}
              <span className="text-muted">total</span>
            </p>
            {isAdmin && balance.data?.balance != null && (
              <p className={clsx('text-sm', total > balance.data.balance ? 'font-medium text-danger' : 'text-muted')}>
                Balance {taka(balance.data.balance)}
                {total > balance.data.balance ? ' is not enough' : `, ${taka(balance.data.balance - total)} after`}
              </p>
            )}
            {leftToday != null && (
              <p className={clsx('text-sm', total > leftToday ? 'font-medium text-[#6e5000]' : 'text-muted')}>
                {total > leftToday ? `Only ${taka(leftToday)} left today; rows past that will be rejected` : `${taka(leftToday)} left today`}
              </p>
            )}
          </div>
          <Button size="lg" disabled={!rows.length || errorCount > 0 || checking} loading={checking && errorCount === 0} onClick={startSend} className="sm:min-w-56">
            {!rows.length
              ? 'Add numbers to review'
              : errorCount
                ? `Fix ${errorCount} row${errorCount === 1 ? '' : 's'} to continue`
                : checking
                  ? 'Checking numbers…'
                  : `Send ${rows.length} recharge${rows.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>

      <RecentBatches items={recent.data?.items} />

      <RepeatWarningBulk
        open={repeatOpen}
        rows={repeatRows}
        onBack={() => setRepeatOpen(false)}
        onContinue={(removeKeys) => {
          const drop = new Set(removeKeys);
          const remaining = rows.filter((r) => !drop.has(r.key));
          setRows(remaining);
          setRepeatOpen(false);
          if (drop.size) toast(`Removed ${drop.size} number${drop.size === 1 ? '' : 's'} recharged in the last 28 days`);
          if (remaining.length) setConfirming(true);
        }}
      />

      <ConfirmBulk
        open={confirming}
        rows={rows}
        total={total}
        dupeCount={dupeCount}
        onClose={() => setConfirming(false)}
        onSent={() => {
          setRows([]);
          saveDraft([]);
        }}
      />
    </>
  );
}

// ───────────────────────────── inputs ─────────────────────────────

function TypeInput({ onAdd, full }: { onAdd: (r: BulkRow) => void; full: boolean }) {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [jolt, setJolt] = useState(0);
  const numberRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const row = newRow({ number, amount: amount ? Number(amount) : null, operator: null });
    const err = rowError(row, null);
    if (err && err !== 'Choose the operator') {
      setError(err);
      setJolt((n) => n + 1);
      (/Number/.test(err) ? numberRef : amountRef).current?.focus();
      return;
    }
    onAdd(row);
    setNumber('');
    setError(null);
    numberRef.current?.focus();
  };

  return (
    <div>
      <ShakeOn trigger={jolt} className="flex gap-2">
        <input
          ref={numberRef}
          value={fmtPhone(number)}
          onChange={(e) => {
            setNumber(cleanNumber(e.target.value));
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              amountRef.current?.focus();
            }
          }}
          inputMode="numeric"
          placeholder="01XXXXXXXXX"
          aria-label="Mobile number"
          className="tabular h-12 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3.5 text-lg font-medium focus:border-flag focus:ring-3 focus:ring-flag/15 focus:outline-none"
        />
        <div className="flex h-12 w-28 items-center rounded-lg border border-line-strong bg-surface px-3 focus-within:border-flag focus-within:ring-3 focus-within:ring-flag/15 sm:w-36">
          <span className="text-muted">৳</span>
          <input
            ref={amountRef}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            inputMode="numeric"
            placeholder="Amount"
            aria-label="Amount in taka"
            className="tabular h-full w-full min-w-0 bg-transparent pl-1.5 text-lg font-medium focus:outline-none"
          />
        </div>
        <Button size="lg" onClick={submit} disabled={full} aria-label="Add to list" className="!h-12 !px-4">
          <IconPlus className="size-5" />
        </Button>
      </ShakeOn>
      <p className={clsx('mt-2 min-h-5 text-sm', error ? 'text-danger' : 'text-muted')} role={error ? 'alert' : undefined}>
        {error ?? (full ? `The list is full (${BULK_MAX} numbers).` : 'Enter adds the number. The amount stays filled for the next one.')}
      </p>
    </div>
  );
}

function PasteInput({ onAdd }: { onAdd: (rows: BulkRow[], skipped: number) => number }) {
  const [text, setText] = useState('');
  return (
    <div>
      <label htmlFor="bulk-paste" className="text-sm text-muted">
        One per line: number and amount, or operator, number and amount
      </label>
      <textarea
        id="bulk-paste"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={'01712345678,100\n01812345678 200\nRobi, 01812345679, 50'}
        className="tabular mt-1.5 w-full resize-y rounded-lg border border-line-strong bg-surface px-3.5 py-3 font-mono text-[14px] leading-relaxed focus:border-flag focus:ring-3 focus:ring-flag/15 focus:outline-none"
      />
      <Button
        className="mt-3 w-full"
        size="lg"
        disabled={!text.trim()}
        onClick={() => {
          const { rows, skipped } = parseText(text);
          if (onAdd(rows, skipped)) setText('');
        }}
      >
        Add from paste
      </Button>
    </div>
  );
}

function ExcelInput({ onAdd }: { onAdd: (rows: BulkRow[], skipped: number) => number }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'sample' | 'read' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sample = async () => {
    setBusy('sample');
    try {
      const { default: writeExcelFile } = await import('write-excel-file/browser');
      const head = ['Operator', 'Number', 'Amount'].map((value) => ({ value, fontWeight: 'bold' as const }));
      const rows = [
        ['GP', '01712345678', 100],
        ['', '01812345678', 50],
        ['Banglalink', '01912345678', 20],
      ].map(([op, n, a]) => [{ value: String(op) }, { value: String(n), type: String }, { value: Number(a), type: Number }]);
      await writeExcelFile([head, ...rows], { columns: [{ width: 14 }, { width: 16 }, { width: 10 }] }).toFile('bulk-recharge-sample.xlsx');
    } catch (e) {
      toast((e as Error).message || 'Could not create the sample file', 'error');
    } finally {
      setBusy(null);
    }
  };

  const read = async (file: File) => {
    setBusy('read');
    try {
      let result: { rows: BulkRow[]; skipped: number };
      if (/\.(csv|txt)$/i.test(file.name)) {
        result = parseText(await file.text());
      } else {
        const { readSheet } = await import('read-excel-file/browser');
        const data = await readSheet(file);
        const rows: BulkRow[] = [];
        let skipped = 0;
        data.forEach((cells, i) => {
          const r = parseCells(cells as unknown[]);
          if (r) rows.push(r);
          else if (i > 0 && (cells as unknown[]).some((c) => c != null && String(c).trim())) skipped++; // row 1 may be a header
        });
        result = { rows, skipped };
      }
      onAdd(result.rows, result.skipped);
    } catch {
      toast("Couldn't read that file. Use .xlsx or .csv with Number and Amount columns.", 'error');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <p className="text-sm text-muted">Columns: Number, Amount. An Operator column first is optional; without it the operator comes from the prefix.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" size="lg" onClick={sample} loading={busy === 'sample'}>
          <IconDownload className="size-4" /> Download sample
        </Button>
        <Button size="lg" onClick={() => fileRef.current?.click()} loading={busy === 'read'}>
          <IconUpload className="size-4" /> Upload Excel or CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
          }}
        />
      </div>
    </div>
  );
}

// ───────────────────────────── review ─────────────────────────────

function ReviewRow({
  index,
  row,
  error,
  duplicate,
  last,
  recentRepeat,
  onChange,
  onRemove,
  ref,
}: {
  index: number;
  row: BulkRow;
  error: string | null;
  duplicate: boolean;
  last?: Last;
  /** employee only: recharged (Successful or open) in the last 28 days */
  recentRepeat: boolean;
  onChange: (p: Partial<BulkRow>) => void;
  onRemove: () => void;
  ref?: React.Ref<HTMLLIElement>;
}) {
  const recentToday = last && dhakaDayKey(last.createdAt) === dhakaToday() && last.status !== 'Failed' && last.status !== 'Cancel';
  const warn = recentToday || recentRepeat;
  const control = 'h-9 rounded-md border border-line-strong bg-surface px-2 text-[14px] focus:border-flag focus:outline-none';
  return (
    <m.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0, transition: { duration: dur.base, ease: EASE_OUT } }}
      exit={{ opacity: 0, x: 16, transition: { duration: dur.fast } }}
      className={clsx(
        'relative border-b border-line px-4 py-3 last:border-0 sm:px-5',
        error ? 'bg-danger-tint/40' : warn || duplicate ? 'bg-marigold-tint/40' : '',
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: error ? 'var(--color-danger)' : warn || duplicate ? 'var(--color-marigold)' : 'transparent' }}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="tabular w-6 shrink-0 text-right text-sm text-muted">{index + 1}</span>
        <input
          value={fmtPhone(row.number)}
          onChange={(e) => onChange({ number: cleanNumber(e.target.value) })}
          inputMode="numeric"
          aria-label={`Number, row ${index + 1}`}
          className={clsx(control, 'tabular w-[9.5rem] font-medium')}
        />
        <select
          value={row.operator ?? ''}
          onChange={(e) => onChange({ operator: (e.target.value || null) as Operator | null })}
          aria-label={`Operator, row ${index + 1}`}
          className={clsx(control, 'w-[8.5rem]', !row.operator && 'border-danger text-danger')}
        >
          <option value="">Operator…</option>
          {OPERATORS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          value={row.type}
          onChange={(e) => onChange({ type: e.target.value as RechargeType })}
          aria-label={`Connection, row ${index + 1}`}
          className={clsx(control, 'w-[6.5rem]')}
        >
          <option value="prepaid">Prepaid</option>
          <option value="postpaid">Postpaid</option>
        </select>
        <div className={clsx(control, 'flex w-24 items-center')}>
          <span className="text-muted">৳</span>
          <input
            value={row.amount ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              onChange({ amount: v ? Number(v) : null });
            }}
            inputMode="numeric"
            aria-label={`Amount, row ${index + 1}`}
            className="tabular h-full w-full min-w-0 bg-transparent pl-1 font-medium focus:outline-none"
          />
        </div>
        <button onClick={onRemove} className="ml-auto grid size-9 place-items-center rounded-md text-muted hover:bg-danger-tint hover:text-danger" aria-label={`Remove row ${index + 1}`}>
          <IconTrash className="size-4" />
        </button>
      </div>
      {(error || duplicate || warn) && (
        <p className={clsx('mt-1.5 pl-9 text-sm', error ? 'text-danger' : 'text-[#6e5000]')}>
          {error ??
            [
              duplicate && 'Duplicate in this list',
              recentToday
                ? `Already recharged today: ${taka(last!.amount)} at ${fmtClock(last!.createdAt)} by ${creatorName(last!.createdBy)}`
                : recentRepeat && last?.lastDone && `Recharged in the last 28 days: ${lastDoneLine(last.lastDone)}`,
            ]
              .filter(Boolean)
              .join('. ')}
        </p>
      )}
    </m.li>
  );
}

// ───────────────────────────── confirm ─────────────────────────────

function ConfirmBulk({
  open,
  rows,
  total,
  dupeCount,
  onClose,
  onSent,
}: {
  open: boolean;
  rows: BulkRow[];
  total: number;
  dupeCount: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(0);
  const [allowDupes, setAllowDupes] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const pace = useBulkPace();

  const byOperator = useMemo(() => {
    const map = new Map<Operator, { count: number; amount: number }>();
    for (const r of rows) {
      if (!r.operator) continue;
      const v = map.get(r.operator) ?? { count: 0, amount: 0 };
      v.count++;
      v.amount += r.amount ?? 0;
      map.set(r.operator, v);
    }
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [rows]);

  const send = useMutation({
    mutationFn: () =>
      api<{ batch: BulkBatch }>('/api/bulk', {
        method: 'POST',
        body: {
          pin,
          allowDuplicates: allowDupes,
          items: rows.map((r) => ({ number: r.number, operator: r.operator, type: r.type, amount: r.amount })),
        },
      }),
    onSuccess: ({ batch }) => {
      onSent();
      router.push(`/bulk/${batch.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'INVALID_PIN') {
        setPin('');
        setShake((n) => n + 1);
        setTimeout(() => pinRef.current?.focus(), 0);
      }
    },
  });
  const err = send.error instanceof ApiError ? send.error : null;
  const pinError = err && ['INVALID_PIN', 'PIN_LOCKED', 'PIN_NOT_CONFIGURED'].includes(err.code) ? err.message : null;
  const locked = err?.code === 'PIN_LOCKED' || err?.code === 'PIN_NOT_CONFIGURED';
  const needsDupeOk = dupeCount > 0 && !allowDupes;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!send.isPending) onClose();
      }}
      title="Check and send"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={send.isPending}>
            Back to list
          </Button>
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={pin.length !== 6 || locked || needsDupeOk}>
            {send.isPending ? 'Starting…' : `Send ${taka(total)}`}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.length === 6 && !locked && !needsDupeOk) send.mutate();
        }}
      >
        <div className="receipt px-5 pt-6 pb-7">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">{rows.length} recharges</span>
            <span className="tabular font-display text-[30px] leading-none font-extrabold">{taka(total)}</span>
          </div>
          <div className="receipt-rule my-4" />
          <ul className="space-y-1.5 text-sm">
            {byOperator.map(([op, v]) => (
              <li key={op} className="flex items-center gap-2">
                <OperatorMark op={op} size="sm" />
                <span className="flex-1">{OPERATOR_BY_CODE[op].name}</span>
                <span className="tabular text-muted">{v.count}×</span>
                <span className="tabular w-20 text-right font-medium">{taka(v.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="receipt-rule my-4" />
          <PinPad
            ref={pinRef}
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (err?.code === 'INVALID_PIN') send.reset();
            }}
            error={pinError}
            disabled={locked || send.isPending}
            shakeKey={shake}
            autoFocus
          />
        </div>
        {dupeCount > 0 && (
          <label className="mt-4 flex items-start gap-2.5 rounded-lg bg-marigold-tint px-3 py-2.5 text-sm text-[#6e5000]">
            <input type="checkbox" checked={allowDupes} onChange={(e) => setAllowDupes(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-flag)]" />
            <span>
              {dupeCount} rows repeat a number in this list. Tick to send them anyway; each one is a separate top-up.
            </span>
          </label>
        )}
        {err && !pinError && (
          <p className="mt-4 rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-[#8d1424]" role="alert">
            {err.message}
          </p>
        )}
        <p className="mt-3 text-sm text-muted">
          Numbers are sent one at a time{pace.data ? (pace.data.gapMs ? `, ${fmtGap(pace.data.gapMs)} apart` : ' with no pause') : ''}. You can leave this
          page; the batch keeps going.
        </p>
      </form>
    </Modal>
  );
}

// ───────────────────────────── recent ─────────────────────────────

function RecentBatches({ items }: { items?: BulkSummary[] }) {
  if (!items) return null;
  return (
    <Panel className="mt-6 overflow-hidden">
      <PanelHead title="Recent batches" />
      {items.length === 0 ? (
        <Empty title="No batches yet" body="Batches you and your team send show up here." />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((b) => {
            const done = b.counts.sent + b.counts.rejected + b.counts.skipped;
            return (
              <li key={b.id}>
                <Link href={`/bulk/${b.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper/60 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="tabular">{b.total}</span> numbers, <span className="tabular">{taka(b.amountTotal)}</span>
                    </p>
                    <p className="truncate text-sm text-muted" title={fmtDateTime(b.createdAt)}>
                      {timeAgo(b.createdAt)} by {b.createdBy?.name ?? 'someone'}
                    </p>
                  </div>
                  <div className="hidden w-32 sm:block" aria-hidden>
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
                      <div className="h-full rounded-full bg-chart" style={{ width: `${(done / Math.max(1, b.total)) * 100}%` }} />
                    </div>
                    <p className="tabular mt-1 text-right text-xs text-muted">
                      {done}/{b.total}
                    </p>
                  </div>
                  <BatchStatus status={b.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

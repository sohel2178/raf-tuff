'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, m } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { SlidingMarker } from '@/components/motion';
import { PinPad } from '@/components/recharge/PinPad';
import { Receipt } from '@/components/recharge/Receipt';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/field';
import { OperatorMark, StatusBadge } from '@/components/ui/status';
import { ApiError, api, newIdempotencyKey } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { MIN_AMOUNT, OPEN_STATUSES, OPERATORS, PHONE_REGEX, QUICK_AMOUNTS, detectOperator } from '@/lib/constants';
import { cleanNumber, creatorName, dhakaDayKey, dhakaToday, fmtDateTime, fmtDay, fmtPhone, taka, timeAgo } from '@/lib/format';
import { EASE_OUT, dur, feed, spring, unfold } from '@/lib/motion';
import type { Operator, Paged, Recharge, RechargeStatus, RechargeType, Totals } from '@/lib/types';

type Draft = { number: string; operator: Operator; type: RechargeType; amount: number };
type LastRow = { trxid: string; amount: number; status: RechargeStatus; createdAt: string; createdBy?: unknown };
type NumberInfo = {
  summary: { usualOperator: Operator | null; lastRecharge: LastRow | null; lastSuccess: LastRow | null; count: number };
};

export default function RechargePage() {
  return (
    <Suspense>
      <RechargeFlow />
    </Suspense>
  );
}

function RechargeFlow() {
  const sp = useSearchParams();
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<Recharge | null>(null);
  const initialNumber = cleanNumber(sp.get('number') ?? '');

  // Steps move as one track: forward slides left, back (Edit) slides right.
  const order = { form: 0, confirm: 1, done: 2 } as const;
  const prev = useRef(step);
  const dir = order[step] >= order[prev.current] ? 1 : -1;
  useEffect(() => {
    prev.current = step;
  }, [step]);

  const restart = (keepNumber?: Draft) => {
    setResult(null);
    setDraft(keepNumber ?? null);
    setStep('form');
  };

  return (
    <div className="mx-auto max-w-[520px]">
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <m.div
          key={step}
          custom={dir}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 36 }),
            center: { opacity: 1, x: 0, transition: { duration: dur.base, ease: EASE_OUT } },
            exit: (d: number) => ({ opacity: 0, x: d * -36, transition: { duration: dur.fast, ease: EASE_OUT } }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          onAnimationStart={() => window.scrollTo({ top: 0 })}
        >
      {step === 'form' && (
        <RechargeForm
          initial={draft ?? (initialNumber ? { number: initialNumber } : undefined)}
          onContinue={(d) => {
            setDraft(d);
            setStep('confirm');
          }}
        />
      )}
      {step === 'confirm' && draft && (
        <Confirm
          draft={draft}
          onBack={() => setStep('form')}
          onDone={(r) => {
            setResult(r);
            setStep('done');
          }}
        />
      )}
      {step === 'done' && result && <Result initial={result} onNew={() => restart()} onAgain={() => draft && restart(draft)} />}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────── Step 1: form ─────────────────────────────

function RechargeForm({ initial, onContinue }: { initial?: Partial<Draft>; onContinue: (d: Draft) => void }) {
  const user = useUser();
  const isAdmin = user.role === 'admin';
  const limit = isAdmin ? null : (user.rechargeLimit ?? 0);

  const [number, setNumber] = useState(initial?.number ?? '');
  const [operator, setOperator] = useState<Operator | null>(initial?.operator ?? null);
  const [opSource, setOpSource] = useState<'manual' | 'history' | 'prefix' | null>(initial?.operator ? 'manual' : null);
  const [type, setType] = useState<RechargeType>(initial?.type ?? 'prepaid');
  const [amountText, setAmountText] = useState(initial?.amount ? String(initial.amount) : '');
  const [touched, setTouched] = useState(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const complete = PHONE_REGEX.test(number);
  const amount = Number(amountText);

  // History for this exact number: usual operator + last success
  const info = useQuery({
    queryKey: ['number-hint', number],
    queryFn: () => api<NumberInfo>(`/api/numbers/${number}`, { query: { limit: 1 } }),
    enabled: complete,
    staleTime: 60_000,
  });

  // Today's spend (for daily limit hint)
  const today = useQuery({
    queryKey: ['summary', 'today'],
    queryFn: () => api<{ totals: Totals }>('/api/reports/summary', { query: { preset: 'today' } }),
    enabled: !isAdmin && user.dailyLimit != null,
  });
  const usedToday = today.data ? today.data.totals.amount + today.data.totals.pendingAmount : null;
  const leftToday = user.dailyLimit != null && usedToday != null ? Math.max(0, user.dailyLimit - usedToday) : null;
  const effectiveMax = [limit, leftToday].filter((v): v is number => v != null).reduce((a, b) => Math.min(a, b), Infinity);

  // Recently used numbers for one-tap repeat
  const recent = useQuery({
    queryKey: ['recent-numbers'],
    queryFn: () => api<Paged<Recharge>>('/api/recharges', { query: { pageSize: 30 } }),
    staleTime: 30_000,
  });
  const recentNumbers = useMemo(() => {
    const seen = new Map<string, Recharge>();
    for (const r of recent.data?.items ?? []) if (!seen.has(r.number)) seen.set(r.number, r);
    return [...seen.values()].slice(0, 6);
  }, [recent.data]);

  // Operator suggestion: manual > this number's history > prefix
  useEffect(() => {
    if (opSource === 'manual') return;
    const fromHistory = info.data?.summary.usualOperator;
    if (complete && fromHistory) {
      setOperator(fromHistory);
      setOpSource('history');
    } else {
      const p = detectOperator(number);
      setOperator(p);
      setOpSource(p ? 'prefix' : null);
    }
  }, [number, complete, info.data, opSource]);

  const errors = {
    number: !number ? 'Enter the mobile number' : !complete ? 'Number must be 11 digits starting with 013–019' : null,
    operator: !operator ? 'Choose the operator' : null,
    amount: !amountText
      ? 'Enter an amount'
      : !Number.isInteger(amount)
        ? 'Use whole taka only'
        : amount < MIN_AMOUNT
          ? `Minimum is ${taka(MIN_AMOUNT)}`
          : limit != null && amount > limit
            ? `Your limit is ${taka(limit)} per recharge`
            : leftToday != null && amount > leftToday
              ? `Only ${taka(leftToday)} left of today's limit`
              : null,
  };
  const pinMissing = user.rechargePinConfigured === false;
  const valid = !errors.number && !errors.operator && !errors.amount && !pinMissing;

  const chips = QUICK_AMOUNTS.filter((a) => a <= effectiveMax);
  if (limit != null && !chips.includes(limit) && limit >= MIN_AMOUNT && limit <= effectiveMax) chips.push(limit);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (pinMissing) return;
    if (!valid) {
      (errors.number ? numberRef : amountRef).current?.focus();
      return;
    }
    onContinue({ number, operator: operator!, type, amount });
  };

  const pickRecent = (r: Recharge) => {
    setNumber(r.number);
    setOperator(r.operator);
    setOpSource('manual');
    setType(r.type);
    amountRef.current?.focus();
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">New recharge</h1>
      <p className="mt-1 text-muted">
        {isAdmin ? 'No amount limit on your account.' : `Up to ${taka(limit)} per recharge`}
        {leftToday != null && ` · ${taka(leftToday)} left today`}
      </p>
      {pinMissing && (
        <p className="mt-4 rounded-lg border border-marigold/50 bg-marigold-tint px-4 py-3 text-sm text-[#6e5000]" role="status">
          Recharges are paused: no recharge PIN is set on the server.{' '}
          {isAdmin ? 'Add RECHARGE_PIN to the backend .env and restart the API.' : 'Ask your admin to set one.'}
        </p>
      )}

      {/* Number — the hero of this screen */}
      <div className="mt-6">
        <label htmlFor="number" className="text-sm font-medium text-ink-2">
          Mobile number
        </label>
        <div
          className={clsx(
            'mt-1.5 flex items-center gap-3 rounded-xl border-2 bg-surface px-4 transition-colors focus-within:border-flag',
            touched && errors.number ? 'border-danger' : 'border-line-strong',
          )}
        >
          <input
            ref={numberRef}
            id="number"
            value={fmtPhone(number)}
            onChange={(e) => {
              setNumber(cleanNumber(e.target.value));
              if (opSource !== 'manual') setOpSource(null);
            }}
            onPaste={(e) => {
              e.preventDefault();
              setNumber(cleanNumber(e.clipboardData.getData('text')));
            }}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="01XXXXXXXXX"
            autoFocus={!initial?.number}
            aria-invalid={touched && !!errors.number}
            aria-describedby="number-help"
            className="tabular h-16 min-w-0 flex-1 bg-transparent font-display focus-visible:outline-none text-[30px] font-bold tracking-tight outline-none placeholder:font-medium placeholder:text-line-strong sm:text-[34px]"
          />
          <AnimatePresence mode="popLayout" initial={false}>
            {operator && (
              <m.span
                key={operator}
                initial={{ scale: 0.4, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, transition: { duration: dur.fast } }}
                transition={spring.stamp}
                className="inline-flex"
              >
                <OperatorMark op={operator} size="lg" />
              </m.span>
            )}
          </AnimatePresence>
        </div>
        <p id="number-help" className={clsx('mt-1.5 min-h-5 text-sm', touched && errors.number ? 'text-danger' : 'text-muted')}>
          {touched && errors.number
            ? errors.number
            : complete && info.isLoading
              ? 'Checking this number’s history…'
              : complete && info.data && info.data.summary.count === 0
                ? 'First recharge to this number'
                : opSource === 'prefix'
                  ? 'Operator guessed from the prefix. Change it if the SIM was ported.'
                  : ' '}
        </p>
        <AnimatePresence initial={false}>
          {complete && info.data?.summary.lastRecharge && (
            <m.div key="last" {...unfold} className="overflow-hidden">
              <LastRechargeCard number={number} summary={info.data.summary} />
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {recentNumbers.length > 0 && !number && (
        <div className="mt-2">
          <p className="text-sm text-muted">Recent</p>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {recentNumbers.map((r) => (
              <button
                key={r.number}
                type="button"
                onClick={() => pickRecent(r)}
                className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-1.5 text-sm hover:border-ink-2"
              >
                <OperatorMark op={r.operator} size="sm" />
                <span className="tabular">{fmtPhone(r.number)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Operator */}
      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-ink-2">Operator</legend>
        <div className="mt-1.5 grid grid-cols-4 gap-2">
          {OPERATORS.map((o) => {
            const on = operator === o.code;
            return (
              <button
                key={o.code}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setOperator(o.code);
                  setOpSource('manual');
                }}
                className={clsx(
                  'relative flex h-14 min-w-0 flex-col items-center justify-center rounded-lg border-2 border-transparent bg-paper-2 px-1 text-center text-[12px] leading-tight font-medium hyphens-manual transition-colors active:scale-[0.97] sm:text-[13px]',
                  on ? 'text-ink' : 'text-ink-2 hover:border-line-strong',
                )}
              >
                {on && <SlidingMarker id="op-pick" className="-inset-0.5 rounded-lg border-2 border-ink bg-surface" />}
                <span className="relative mb-1 h-1.5 w-6 shrink-0 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
                <span className="relative max-w-full break-words">{o.name.replace('Grameenphone', 'Grameen\u00ADphone').replace('Banglalink', 'Bangla\u00ADlink')}</span>
              </button>
            );
          })}
        </div>
        {touched && errors.operator && <p className="mt-1.5 text-sm text-danger">{errors.operator}</p>}
      </fieldset>

      <div className="mt-6">
        <p className="text-sm font-medium text-ink-2" id="type-label">
          Connection
        </p>
        <Segmented
          label="Connection type"
          className="mt-1.5 w-full"
          value={type}
          onChange={setType}
          options={[
            { value: 'prepaid', label: 'Prepaid' },
            { value: 'postpaid', label: 'Postpaid' },
          ]}
        />
      </div>

      {/* Amount */}
      <div className="mt-6">
        <label htmlFor="amount" className="text-sm font-medium text-ink-2">
          Amount
        </label>
        <div
          className={clsx(
            'mt-1.5 flex items-center rounded-xl border-2 bg-surface px-4 focus-within:border-flag',
            touched && errors.amount ? 'border-danger' : 'border-line-strong',
          )}
        >
          <span className="font-display text-2xl font-bold text-muted">৳</span>
          <input
            ref={amountRef}
            id="amount"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="0"
            aria-invalid={touched && !!errors.amount}
            className="tabular h-14 min-w-0 flex-1 bg-transparent pl-2 font-display focus-visible:outline-none text-[28px] font-bold outline-none placeholder:text-line-strong"
          />
        </div>
        {touched && errors.amount && <p className="mt-1.5 text-sm text-danger">{errors.amount}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.sort((a, b) => a - b).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmountText(String(a))}
              aria-pressed={amount === a}
              className={clsx(
                'tabular relative h-10 min-w-16 rounded-full border px-4 font-medium transition-colors duration-200 active:scale-[0.96]',
                amount === a ? 'border-ink text-white' : 'border-line-strong bg-surface hover:border-ink-2',
              )}
            >
              {amount === a && <SlidingMarker id="amount-chip" className="-inset-px rounded-full bg-ink" />}
              <span className="relative">{taka(a)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sticky bottom-[76px] -mx-4 mt-8 bg-gradient-to-t from-paper from-70% to-transparent px-4 pt-4 pb-2 lg:static lg:mx-0 lg:bg-none lg:p-0">
        <Button type="submit" size="lg" className="w-full shadow-[0_8px_20px_-8px_rgba(0,81,59,0.6)] lg:shadow-none">
          {valid ? `Review ${taka(amount)} to ${fmtPhone(number)}` : 'Review recharge'}
        </Button>
      </div>
    </form>
  );
}


/** Shop-wide last recharge to this number (any user, any status), so nobody tops up twice by accident. */
function LastRechargeCard({ number, summary, compact }: { number: string; summary: NumberInfo['summary']; compact?: boolean }) {
  const last = summary.lastRecharge;
  if (!last) return null;
  const today = dhakaDayKey(last.createdAt) === dhakaToday();
  const counts = last.status !== 'Failed' && last.status !== 'Cancel';
  const warn = today && counts;
  const success = summary.lastSuccess;
  return (
    <div
      className={clsx(
        'mt-2 rounded-lg border px-3.5 py-2.5 text-sm',
        warn ? 'border-marigold/60 bg-marigold-tint text-[#6e5000]' : 'border-line bg-surface text-ink-2',
      )}
      role={warn ? 'status' : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{warn ? 'Already recharged today' : 'Last recharge'}</p>
        {!compact && (
          <Link href={`/numbers/${number}`} className="shrink-0 text-flag underline-offset-4 hover:underline">
            See all{summary.count > 1 ? ` ${summary.count}` : ''}
          </Link>
        )}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular font-semibold text-ink">{taka(last.amount)}</span>
        <StatusBadge status={last.status} />
        <span className="tabular" title={fmtDateTime(last.createdAt)}>
          {fmtDateTime(last.createdAt)}
          {Date.now() - new Date(last.createdAt).getTime() < 86_400_000 && ` · ${timeAgo(last.createdAt)}`}
        </span>
        <span className="text-muted">by {creatorName(last.createdBy)}</span>
      </p>
      {last.status !== 'Success' && success && (
        <p className="mt-1 text-muted">
          Last successful: <span className="tabular">{taka(success.amount)}</span> on {fmtDay(dhakaDayKey(success.createdAt))} by{' '}
          {creatorName(success.createdBy)}
        </p>
      )}
    </div>
  );
}

// ───────────────────────────── Step 2: confirm ─────────────────────────────

function Confirm({ draft, onBack, onDone }: { draft: Draft; onBack: () => void; onDone: (r: Recharge) => void }) {
  const qc = useQueryClient();
  // One key per attempt: re-tapping after a network error re-sends the SAME key, so it can never double-charge.
  const [key] = useState(newIdempotencyKey);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(0);
  const pinRef = useRef<HTMLInputElement>(null);
  // Same cache as the form's lookup, so this is usually instant.
  const info = useQuery({
    queryKey: ['number-hint', draft.number],
    queryFn: () => api<NumberInfo>(`/api/numbers/${draft.number}`, { query: { limit: 1 } }),
    staleTime: 60_000,
  });

  const send = useMutation({
    mutationFn: () =>
      api<{ recharge: Recharge }>('/api/recharges', {
        method: 'POST',
        body: { ...draft, pin },
        headers: { 'Idempotency-Key': key },
      }),
    onSuccess: (r) => {
      setPin('');
      qc.invalidateQueries({ queryKey: ['recharges'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['recent-numbers'] });
      qc.invalidateQueries({ queryKey: ['number-hint'] });
      qc.invalidateQueries({ queryKey: ['number'] });
      onDone(r.recharge);
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
  const isLimit = err && ['LIMIT_EXCEEDED', 'DAILY_LIMIT_EXCEEDED', 'INSUFFICIENT_BALANCE'].includes(err.code);
  const otherError = send.error && !pinError ? send.error : null;
  const canSend = pin.length === 6 && !locked && !isLimit && !send.isPending;

  return (
    <div>
      <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">Check and send</h1>
      <p className="mt-1 text-muted">The operator can&apos;t reverse a recharge once it&apos;s sent.</p>
      {info.data?.summary.lastRecharge && <LastRechargeCard number={draft.number} summary={info.data.summary} compact />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) send.mutate();
        }}
      >
        <m.div variants={feed} initial="hidden" animate="show" className="mt-6">
        <Receipt {...draft}>
          <div className="receipt-rule my-5" />
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
        </Receipt>
        </m.div>
        {otherError && (
          <div className="mt-5 rounded-lg border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-[#8d1424]" role="alert">
            <p className="font-medium">{otherError.message}</p>
            {err?.code === 'NETWORK' && <p className="mt-1">Tap send again. It&apos;s safe — the same request won&apos;t be charged twice.</p>}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="secondary" size="lg" onClick={onBack} disabled={send.isPending} className="sm:flex-1">
            {isLimit ? 'Change amount' : 'Edit'}
          </Button>
          <Button type="submit" size="lg" loading={send.isPending} disabled={!canSend} className="sm:flex-[2]">
            {send.isPending ? 'Sending…' : `Send ${taka(draft.amount)}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ───────────────────────────── Step 3: result ─────────────────────────────

function Result({ initial, onNew, onAgain }: { initial: Recharge; onNew: () => void; onAgain: () => void }) {
  const q = useQuery({
    queryKey: ['recharge', initial.trxid],
    queryFn: () => api<{ recharge: Recharge }>(`/api/recharges/${initial.trxid}`).then((r) => r.recharge),
    initialData: initial,
    refetchInterval: (query) => (OPEN_STATUSES.includes(query.state.data?.status ?? 'Success') ? 4000 : false),
  });
  const r = q.data;
  const open = OPEN_STATUSES.includes(r.status);
  // Flash once when it turns Successful while you're watching.
  const wasOpen = useRef(OPEN_STATUSES.includes(initial.status));
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (r.status === 'Success' && wasOpen.current) setFlash((n) => n + 1);
    wasOpen.current = OPEN_STATUSES.includes(r.status);
  }, [r.status]);
  const heading = open ? 'Recharge sent' : r.status === 'Success' ? 'Done' : 'Recharge update';
  const copy: Record<string, string> = {
    Pending: 'Queued. Sending to the operator…',
    Processing: 'Sent. Waiting for the operator to confirm — this usually takes under a minute.',
    Success: 'The operator confirmed the top-up.',
    Failed: r.providerMessage ? `Not sent: ${r.providerMessage}` : 'The provider rejected this recharge. No money was taken.',
    Cancel: 'The operator cancelled this recharge.',
    Unknown: r.needsReview
      ? "We couldn't confirm this one. An admin needs to check it before you try again."
      : "We didn't get an answer yet. We're checking with the provider — don't resend.",
  };

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={heading} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: dur.fast }}>
          <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">{heading}</h1>
        </m.div>
      </AnimatePresence>
      <p className="mt-1 text-muted" aria-live="polite">
        {copy[r.status]}
      </p>
      <div className="relative mt-6">
        <AnimatePresence>
          {flash > 0 && (
            <m.div
              key={flash}
              aria-hidden
              className="pointer-events-none absolute -inset-2 rounded-2xl bg-flag/25"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: [0, 1, 0], scale: [0.98, 1.02, 1.03] }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
            />
          )}
        </AnimatePresence>
      <m.div variants={feed} initial="hidden" animate="show" className="relative">
      <Receipt
        number={r.number}
        operator={r.operator}
        type={r.type}
        amount={r.amount}
        status={r.status}
        trxid={r.trxid}
        at={r.createdAt}
      />
      </m.div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={onNew}>
          New recharge
        </Button>
        <Button size="lg" variant="secondary" onClick={onAgain}>
          Same number again
        </Button>
      </div>
      <p className="mt-5 text-center text-sm">
        <Link href={`/numbers/${r.number}`} className="font-medium text-flag underline-offset-4 hover:underline">
          See all recharges to {fmtPhone(r.number)}
        </Link>
      </p>
    </div>
  );
}

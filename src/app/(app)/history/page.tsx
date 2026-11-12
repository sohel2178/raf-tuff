'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, LazyMotion, MotionConfig, m } from 'framer-motion';
import { Suspense, useEffect, useState } from 'react';
import { IconDownload, IconFilter } from '@/components/icons';
import { RechargeDrawer } from '@/components/recharge/RechargeDrawer';
import { HistoryLedger } from '@/components/recharge/HistoryLedger';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Empty, ErrorNote, PageHeader, Pagination, Panel, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { api, download } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { OPEN_STATUSES, OPERATORS, OPERATOR_BY_CODE, STATUSES, STATUS_LABEL } from '@/lib/constants';
import { fmtDay, taka } from '@/lib/format';
import { useDebounced, useUrlState } from '@/lib/hooks';
import type { Operator, Paged, Recharge, RechargeStatus } from '@/lib/types';

const loadMotionFeatures = () => import('@/lib/motionFeatures').then((mod) => mod.default);

export default function HistoryPage() {
  return (
    <Suspense>
      <History />
    </Suspense>
  );
}

function History() {
  const user = useUser();
  const toast = useToast();
  const { get, set } = useUrlState();
  const [open, setOpen] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [numberText, setNumberText] = useState(get('number'));
  const debouncedNumber = useDebounced(numberText.replace(/\D/g, ''), 350);
  useEffect(() => {
    if (debouncedNumber !== get('number')) set({ number: debouncedNumber });
  }, [debouncedNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = get('status') ? (get('status').split(',') as RechargeStatus[]) : [];
  const filters = {
    number: get('number'),
    status: statuses,
    operator: get('operator'),
    type: get('type'),
    createdBy: get('createdBy'),
    from: get('from'),
    to: get('to'),
    minAmount: get('minAmount'),
    maxAmount: get('maxAmount'),
    needsReview: get('needsReview'),
  };
  const page = Number(get('page') || 1);

  const q = useQuery({
    queryKey: ['recharges', filters, page],
    queryFn: () => api<Paged<Recharge>>('/api/recharges', { query: { ...filters, page, pageSize: 25 } }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.items.some((r) => OPEN_STATUSES.includes(r.status)) ? 10_000 : false),
  });

  const staff = useQuery({
    queryKey: ['users-directory'],
    queryFn: () => api<{ items: { id: string; name: string }[] }>('/api/users/directory'),
    staleTime: 60_000,
  });

  // "Processing" also covers queued (Pending) recharges
  const toggleStatus = (s: RechargeStatus) => {
    const group: RechargeStatus[] = s === 'Processing' ? ['Pending', 'Processing'] : [s];
    const next = statuses.includes(s) ? statuses.filter((x) => !group.includes(x)) : [...new Set([...statuses, ...group])];
    set({ status: next.join(',') });
  };
  const activeCount = ['operator', 'type', 'createdBy', 'from', 'to', 'minAmount', 'maxAmount'].filter((k) => get(k)).length;
  const anyFilter = activeCount > 0 || statuses.length > 0 || !!filters.number || !!filters.needsReview;

  const clearAll = () => {
    setNumberText('');
    set({ operator: null, type: null, createdBy: null, from: null, to: null, minAmount: null, maxAmount: null, status: null, number: null });
  };

  // Applied panel filters, shown as removable tokens so they stay visible with the panel closed.
  const staffName = (id: string) => staff.data?.items.find((u) => u.id === id)?.name ?? 'One person';
  const tokens: { key: string; label: string }[] = [
    get('operator') && { key: 'operator', label: OPERATOR_BY_CODE[get('operator') as Operator]?.name ?? get('operator') },
    get('type') && { key: 'type', label: get('type') === 'prepaid' ? 'Prepaid' : 'Postpaid' },
    get('from') && { key: 'from', label: `From ${fmtDay(get('from'))}` },
    get('to') && { key: 'to', label: `Until ${fmtDay(get('to'))}` },
    get('minAmount') && { key: 'minAmount', label: `At least ${taka(Number(get('minAmount')))}` },
    get('maxAmount') && { key: 'maxAmount', label: `At most ${taka(Number(get('maxAmount')))}` },
    get('createdBy') && { key: 'createdBy', label: `Sent by ${get('createdBy') === user.id ? 'you' : staffName(get('createdBy'))}` },
  ].filter((t): t is { key: string; label: string } => !!t);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await download('/api/recharges/export.csv', filters, 'recharges.csv');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <MotionConfig reducedMotion="user">
      <PageHeader
        title="History"
        sub="Every recharge from every staff member and API key."
        actions={
          <Button variant="secondary" onClick={exportCsv} loading={exporting}>
            <IconDownload className="size-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Input
            value={numberText}
            onChange={(e) => setNumberText(e.target.value)}
            placeholder="Search number"
            inputMode="numeric"
            aria-label="Search by mobile number"
            className="tabular"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] sm:pb-0">
          {STATUSES.filter((s) => s !== 'Pending').map((s) => (
            <m.button
              key={s}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleStatus(s)}
              aria-pressed={statuses.includes(s)}
              className={clsx(
                'h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                statuses.includes(s) ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:border-ink-2',
              )}
            >
              {STATUS_LABEL[s]}
            </m.button>
          ))}
        </div>
        <Button variant={activeCount ? 'primary' : 'secondary'} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="sm:ml-auto">
          <IconFilter className="size-4" /> Filters
          <AnimatePresence initial={false}>
            {activeCount > 0 && (
              <m.span
                key={activeCount}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 600, damping: 24 }}
                className="tabular -mr-1 grid size-5 place-items-center rounded-full bg-white text-xs font-semibold text-flag-deep"
              >
                {activeCount}
              </m.span>
            )}
          </AnimatePresence>
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {showFilters && (
          <m.div
            key="filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <Panel className="mt-3 grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
              <Field label="Operator">
                <Select value={get('operator')} onChange={(e) => set({ operator: e.target.value })}>
                  <option value="">All operators</option>
                  {OPERATORS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Connection">
                <Select value={get('type')} onChange={(e) => set({ type: e.target.value })}>
                  <option value="">Prepaid and postpaid</option>
                  <option value="prepaid">Prepaid</option>
                  <option value="postpaid">Postpaid</option>
                </Select>
              </Field>
              <Field label="From">
                <Input type="date" value={get('from')} max={get('to') || undefined} onChange={(e) => set({ from: e.target.value })} />
              </Field>
              <Field label="To">
                <Input type="date" value={get('to')} min={get('from') || undefined} onChange={(e) => set({ to: e.target.value })} />
              </Field>
              <Field label="Min amount (৳)">
                <Input inputMode="numeric" value={get('minAmount')} onChange={(e) => set({ minAmount: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Max amount (৳)">
                <Input inputMode="numeric" value={get('maxAmount')} onChange={(e) => set({ maxAmount: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Sent by">
                <Select value={get('createdBy')} onChange={(e) => set({ createdBy: e.target.value })}>
                  <option value="">Everyone</option>
                  {staff.data?.items.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id === user.id ? `${u.name} (you)` : u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Button variant="ghost" onClick={() => setShowFilters(false)}>
                  Done
                </Button>
              </div>
            </Panel>
          </m.div>
        )}
      </AnimatePresence>

      {anyFilter && filters.needsReview !== 'true' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <AnimatePresence initial={false} mode="popLayout">
            {tokens.map((t) => (
              <m.button
                key={t.key}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.18 }}
                onClick={() => set({ [t.key]: null })}
                aria-label={`Remove filter: ${t.label}`}
                className="flex h-8 items-center gap-1.5 rounded-full border border-flag/30 bg-flag-tint pr-2 pl-3 font-medium text-flag-deep hover:border-flag"
              >
                {t.label}
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m4.5 4.5 7 7m0-7-7 7" strokeLinecap="round" />
                </svg>
              </m.button>
            ))}
          </AnimatePresence>
          <m.p layout className="flex items-center gap-3 text-muted sm:ml-auto">
            {q.data && (
              <span>
                <strong className="tabular font-semibold text-ink">{q.data.total.toLocaleString('en-IN')}</strong> matching recharge
                {q.data.total === 1 ? '' : 's'}
              </span>
            )}
            <button className="font-medium text-flag hover:underline" onClick={clearAll}>
              Clear all
            </button>
          </m.p>
        </div>
      )}

      {filters.needsReview === 'true' && (
        <p className="mt-3 rounded-lg bg-unknown-tint px-4 py-2 text-sm text-unknown">
          Showing recharges that need manual review.{' '}
          <button className="font-medium underline" onClick={() => set({ needsReview: null })}>
            Show all
          </button>
        </p>
      )}

      <Panel className="mt-4 overflow-clip">
        {q.error && (
          <div className="p-4">
            <ErrorNote error={q.error} retry={() => q.refetch()} />
          </div>
        )}
        {q.isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        )}
        {q.data && q.data.items.length === 0 && (
          <Empty
            title={anyFilter ? 'Nothing matches these filters' : 'No recharges yet'}
            body={anyFilter ? 'Try a wider date range or remove a filter.' : 'Recharges from every staff member will show up here.'}
            action={
              anyFilter ? (
                <Button variant="secondary" onClick={clearAll}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        )}
        {q.data && q.data.items.length > 0 && (
          <div className={clsx('transition-opacity', q.isPlaceholderData && 'opacity-60')}>
            <HistoryLedger items={q.data.items} page={q.data.page} totalPages={q.data.totalPages} onOpen={setOpen} />
            <div className="border-t border-line">
              <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={(p) => set({ page: p }, { resetPage: false })} />
            </div>
          </div>
        )}
      </Panel>

      <RechargeDrawer trxid={open} onClose={() => setOpen(null)} />
    </MotionConfig>
    </LazyMotion>
  );
}

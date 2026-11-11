'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Suspense, useEffect, useState } from 'react';
import { IconDownload, IconFilter } from '@/components/icons';
import { RechargeDrawer } from '@/components/recharge/RechargeDrawer';
import { RechargeList } from '@/components/recharge/RechargeList';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Empty, ErrorNote, PageHeader, Pagination, Panel, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { api, download } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { OPEN_STATUSES, OPERATORS, STATUSES, STATUS_LABEL } from '@/lib/constants';
import { useDebounced, useUrlState } from '@/lib/hooks';
import type { Paged, Recharge, RechargeStatus, User } from '@/lib/types';

export default function HistoryPage() {
  return (
    <Suspense>
      <History />
    </Suspense>
  );
}

function History() {
  const user = useUser();
  const isAdmin = user.role === 'admin';
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
    queryKey: ['users'],
    queryFn: () => api<{ items: User[] }>('/api/users'),
    enabled: isAdmin,
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
    <>
      <PageHeader
        title="History"
        sub={isAdmin ? 'Every recharge from every staff member and API key.' : 'Recharges you have sent.'}
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
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              aria-pressed={statuses.includes(s)}
              className={clsx(
                'h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                statuses.includes(s) ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:border-ink-2',
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <Button variant={activeCount ? 'primary' : 'secondary'} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="sm:ml-auto">
          <IconFilter className="size-4" /> Filters{activeCount ? ` (${activeCount})` : ''}
        </Button>
      </div>

      {showFilters && (
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
          {isAdmin && (
            <Field label="Sent by">
              <Select value={get('createdBy')} onChange={(e) => set({ createdBy: e.target.value })}>
                <option value="">Everyone</option>
                {staff.data?.items.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={() => {
                setNumberText('');
                set({ operator: null, type: null, createdBy: null, from: null, to: null, minAmount: null, maxAmount: null, status: null, number: null, needsReview: null });
              }}
            >
              Clear all filters
            </Button>
          </div>
        </Panel>
      )}

      {q.data && anyFilter && filters.needsReview !== 'true' && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>
            Showing <strong className="tabular font-semibold text-ink">{q.data.total.toLocaleString('en-IN')}</strong> matching recharge
            {q.data.total === 1 ? '' : 's'}
          </span>
          <button
            className="font-medium text-flag hover:underline"
            onClick={() => {
              setNumberText('');
              set({ operator: null, type: null, createdBy: null, from: null, to: null, minAmount: null, maxAmount: null, status: null, number: null });
            }}
          >
            Clear filters
          </button>
        </p>
      )}

      {filters.needsReview === 'true' && (
        <p className="mt-3 rounded-lg bg-unknown-tint px-4 py-2 text-sm text-unknown">
          Showing recharges that need manual review.{' '}
          <button className="font-medium underline" onClick={() => set({ needsReview: null })}>
            Show all
          </button>
        </p>
      )}

      <Panel className="mt-4 overflow-hidden">
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
            body={anyFilter ? 'Try a wider date range or clear some filters.' : 'Recharges you send will be listed here.'}
          />
        )}
        {q.data && q.data.items.length > 0 && (
          <div className={clsx(q.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <RechargeList items={q.data.items} onOpen={setOpen} showEmployee={isAdmin} />
            <div className="border-t border-line">
              <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={(p) => set({ page: p }, { resetPage: false })} />
            </div>
          </div>
        )}
      </Panel>

      <RechargeDrawer trxid={open} onClose={() => setOpen(null)} />
    </>
  );
}

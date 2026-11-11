import clsx from 'clsx';
import { ApiError } from '@/lib/api';
import { Button } from './button';

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[32px]">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : 'Something went wrong loading this.';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-[#8d1424]">
      <span>{msg}</span>
      {retry && (
        <Button size="sm" variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-paper-2', className)} />;
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={clsx('rounded-xl border border-line bg-surface', className)}>{children}</section>;
}

export function PanelHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <h2 className="font-display text-base font-bold">{title}</h2>
      {right}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted sm:px-5">
      <span className="tabular">
        {total.toLocaleString('en-IN')} recharge{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="tabular px-1">
          {page} / {totalPages}
        </span>
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

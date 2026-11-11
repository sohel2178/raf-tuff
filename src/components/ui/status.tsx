import clsx from 'clsx';
import { OPERATOR_BY_CODE, STATUS_LABEL } from '@/lib/constants';
import type { Operator, RechargeStatus } from '@/lib/types';

const styles: Record<RechargeStatus, { chip: string; dot: string }> = {
  Pending: { chip: 'bg-marigold-tint text-[#7a5600]', dot: 'bg-marigold animate-pulse-soft' },
  Processing: { chip: 'bg-marigold-tint text-[#7a5600]', dot: 'bg-marigold animate-pulse-soft' },
  Success: { chip: 'bg-flag-tint text-flag-deep', dot: 'bg-flag' },
  Cancel: { chip: 'bg-cancel-tint text-cancel', dot: 'bg-cancel' },
  Failed: { chip: 'bg-danger-tint text-[#a5182b]', dot: 'bg-danger' },
  Unknown: { chip: 'bg-unknown-tint text-unknown', dot: 'bg-unknown' },
};

export function StatusBadge({ status, className }: { status: RechargeStatus; className?: string }) {
  const s = styles[status];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap', s.chip, className)}>
      <span className={clsx('size-1.5 rounded-full', s.dot)} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const statusColor: Record<RechargeStatus, string> = {
  Pending: 'var(--color-marigold)',
  Processing: 'var(--color-marigold)',
  Success: 'var(--color-flag)',
  Cancel: 'var(--color-cancel)',
  Failed: 'var(--color-danger)',
  Unknown: 'var(--color-unknown)',
};

/** Small coloured operator tile with its code. */
export function OperatorMark({ op, size = 'md', withName }: { op: Operator; size?: 'sm' | 'md' | 'lg'; withName?: boolean }) {
  const o = OPERATOR_BY_CODE[op];
  if (!o) return <span>{op}</span>;
  const dims = { sm: 'h-5 min-w-7 text-[11px]', md: 'h-6 min-w-8 text-xs', lg: 'h-9 min-w-12 text-sm' }[size];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={clsx('inline-grid place-items-center rounded-[5px] px-1 font-semibold tracking-wide text-white', dims)}
        style={{ backgroundColor: o.color }}
        title={o.name}
      >
        {op}
      </span>
      {withName && <span className="text-ink-2">{o.name}</span>}
    </span>
  );
}

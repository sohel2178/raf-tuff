import clsx from 'clsx';
import type { BulkStatus } from '@/lib/types';

const LABEL: Record<BulkStatus, string> = { running: 'Sending', paused: 'Paused', done: 'Finished', cancelled: 'Cancelled' };
const TONE: Record<BulkStatus, string> = {
  running: 'bg-marigold-tint text-[#7a5600]',
  paused: 'bg-unknown-tint text-unknown',
  done: 'bg-flag-tint text-flag-deep',
  cancelled: 'bg-cancel-tint text-cancel',
};

export function BatchStatus({ status, className }: { status: BulkStatus; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap', TONE[status], className)}>
      {status === 'running' && <span className="size-1.5 animate-pulse-soft rounded-full bg-marigold" aria-hidden />}
      {LABEL[status]}
    </span>
  );
}

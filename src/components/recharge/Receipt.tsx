import clsx from 'clsx';
import { Stamp } from '@/components/motion';
import { OperatorMark } from '@/components/ui/status';
import { OPERATOR_BY_CODE, STATUS_LABEL } from '@/lib/constants';
import { fmtPhone, fmtTime, taka } from '@/lib/format';
import type { Operator, RechargeStatus, RechargeType } from '@/lib/types';

const stampTone: Record<RechargeStatus, string> = {
  Pending: 'border-marigold text-[#946a00]',
  Processing: 'border-marigold text-[#946a00]',
  Success: 'border-flag text-flag',
  Cancel: 'border-cancel text-cancel',
  Failed: 'border-danger text-danger',
  Unknown: 'border-unknown text-unknown',
};

export function Receipt({
  number,
  operator,
  type,
  amount,
  status,
  trxid,
  at,
  message,
  className,
  children,
}: {
  number: string;
  operator: Operator;
  type: RechargeType;
  amount: number;
  status?: RechargeStatus;
  trxid?: string;
  at?: string;
  message?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={clsx('receipt px-6 pt-8 pb-9', className)}>
      <div className="flex items-center justify-between">
        <OperatorMark op={operator} size="md" withName />
        <span className="text-sm text-muted capitalize">{type}</span>
      </div>
      <p className="mt-5 text-sm text-muted">Mobile number</p>
      <p className="tabular font-display text-[30px] leading-tight font-bold tracking-tight">{fmtPhone(number)}</p>

      <div className="receipt-rule my-5" />
      <div className="flex items-baseline justify-between">
        <span className="text-muted">Amount</span>
        <span className="tabular font-display text-[34px] leading-none font-extrabold">{taka(amount)}</span>
      </div>
      {OPERATOR_BY_CODE[operator] && (
        <p className="mt-1 text-right text-sm text-muted">to {OPERATOR_BY_CODE[operator].name}</p>
      )}
      {status && (
        <div className="mt-4 flex justify-end">
          <Stamp
            stampKey={status}
            role="status"
            className={clsx(
              'rounded-md border-[3px] px-2.5 py-1 font-display text-lg font-extrabold tracking-wide uppercase',
              stampTone[status],
              (status === 'Processing' || status === 'Pending') && '[&>span]:animate-pulse-soft',
            )}
          >
            <span>{STATUS_LABEL[status]}</span>
          </Stamp>
        </div>
      )}

      {(trxid || at) && (
        <>
          <div className="receipt-rule my-5" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {trxid && (
              <>
                <dt className="text-muted">Reference</dt>
                <dd className="text-right font-mono text-[12.5px] break-all">{trxid}</dd>
              </>
            )}
            {at && (
              <>
                <dt className="text-muted">Sent at</dt>
                <dd className="tabular text-right">{fmtTime(at)}</dd>
              </>
            )}
          </dl>
        </>
      )}
      {message && <p className="mt-3 text-sm text-ink-2">{message}</p>}

      {children}
    </div>
  );
}

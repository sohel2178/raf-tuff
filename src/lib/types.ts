export type Role = 'admin' | 'employee';
export type Operator = 'GP' | 'RB' | 'AT' | 'BL' | 'TT' | 'SK' | 'BT' | 'RY';
export type RechargeType = 'prepaid' | 'postpaid';
export type RechargeStatus = 'Pending' | 'Processing' | 'Success' | 'Cancel' | 'Failed' | 'Unknown';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  rechargeLimit: number | null;
  dailyLimit: number | null;
  lastLoginAt: string | null;
  createdAt: string;
  /** false = server has no RECHARGE_PIN, so web recharges are refused */
  rechargePinConfigured?: boolean;
};

export type StatusEvent = {
  status: RechargeStatus;
  source: 'api' | 'poll' | 'webhook' | 'system' | 'manual';
  at: string;
  note?: string;
  raw?: unknown;
};

export type Recharge = {
  id: string;
  trxid: string;
  providerTxnId?: string | null;
  number: string;
  operator: Operator;
  type: RechargeType;
  amount: number;
  packageId?: string | null;
  status: RechargeStatus;
  statusHistory?: StatusEvent[];
  providerMessage?: string | null;
  rawRechargeResponse?: unknown;
  /** Admin only: the provider's latest status reply (poll or manual re-check). */
  lastStatusResponse?: StatusCheck | null;
  createdBy: { id: string; name: string; email: string } | string | null;
  apiKey?: { name: string; prefix: string } | null;
  source: 'web' | 'external-api';
  completedAt?: string | null;
  needsReview?: boolean;
  pollCount?: number;
  lastPolledAt?: string | null;
  /** Set while waiting for Success TopUp's same-amount gap: not sent yet, goes out automatically at sendAfter. */
  queue?: { state: 'waiting' | 'sending'; sendAfter: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

export type Totals = {
  amount: number;
  count: number;
  success: number;
  failed: number;
  cancel: number;
  processing: number;
  unknown: number;
  failedAmount: number;
  pendingAmount: number;
  successRate: number | null;
};

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: ('history:read' | 'recharge:create')[];
  rechargeLimit: number | null;
  ipAllowlist: string[];
  active: boolean;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdBy: { name: string; email: string } | null;
  createdAt: string;
};

export type BulkItemState = 'queued' | 'sending' | 'sent' | 'rejected' | 'skipped';
export type BulkStatus = 'running' | 'paused' | 'done' | 'cancelled';
export type BulkItem = {
  index: number;
  number: string;
  operator: Operator;
  type: RechargeType;
  amount: number;
  state: BulkItemState;
  trxid: string | null;
  error: string | null;
  errorCode: string | null;
  /** live status of the linked recharge */
  status: RechargeStatus | null;
  providerMessage: string | null;
};
export type BulkBatch = {
  id: string;
  createdBy: { id?: string; name: string } | null;
  status: BulkStatus;
  pauseReason: string | null;
  total: number;
  amountTotal: number;
  createdAt: string;
  finishedAt: string | null;
  items: BulkItem[];
};
export type BulkSummary = Omit<BulkBatch, 'items'> & { counts: Record<BulkItemState, number> };

export type BulkPace = { gapMs: number; source: 'app' | 'default' };
export type SameAmountGap = BulkPace & { minMs: number; maxMs: number };

export type StatusCheck = {
  at: string;
  source: 'poll' | 'manual';
  httpStatus: number | null;
  body: unknown;
  /** What we read it as; null = not applied (unknown word, blocked, error). */
  mappedTo: RechargeStatus | null;
  error?: string;
  note?: string;
};

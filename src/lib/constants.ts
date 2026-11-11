import type { Operator, RechargeStatus } from './types';

export const OPERATORS: { code: Operator; name: string; color: string }[] = [
  { code: 'GP', name: 'Grameenphone', color: '#1a95d2' },
  { code: 'RB', name: 'Robi', color: '#d6232b' },
  { code: 'BL', name: 'Banglalink', color: '#f07c1b' },
  { code: 'AT', name: 'Airtel', color: '#b5122d' },
  { code: 'TT', name: 'Teletalk', color: '#4f9e33' },
  { code: 'SK', name: 'Skitto', color: '#17a99d' },
  { code: 'BT', name: 'Brilliant', color: '#7c3f98' },
  { code: 'RY', name: 'Ryze', color: '#d4146f' },
];
export const OPERATOR_BY_CODE = Object.fromEntries(OPERATORS.map((o) => [o.code, o])) as Record<
  Operator,
  (typeof OPERATORS)[number]
>;

/** Skitto, Brilliant and Ryze share prefixes, so they're never auto-detected. */
const PREFIX: Record<string, Operator> = { '013': 'GP', '017': 'GP', '018': 'RB', '016': 'AT', '014': 'BL', '019': 'BL', '015': 'TT' };
export const detectOperator = (n: string): Operator | null => (n.length >= 3 ? (PREFIX[n.slice(0, 3)] ?? null) : null);

export const PHONE_REGEX = /^01[3-9]\d{8}$/;
export const MIN_AMOUNT = 9;
export const QUICK_AMOUNTS = [10, 20, 30, 50, 100, 200, 300, 500, 1000];

export const STATUSES: RechargeStatus[] = ['Pending', 'Processing', 'Success', 'Cancel', 'Failed', 'Unknown'];
export const OPEN_STATUSES: RechargeStatus[] = ['Pending', 'Processing', 'Unknown'];

export const STATUS_LABEL: Record<RechargeStatus, string> = {
  Pending: 'Queued',
  Processing: 'Processing',
  Success: 'Successful',
  Cancel: 'Cancelled',
  Failed: 'Failed',
  Unknown: 'Unknown',
};

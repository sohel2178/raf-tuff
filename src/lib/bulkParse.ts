import { MIN_AMOUNT, PHONE_REGEX, detectOperator } from './constants';
import { cleanNumber, taka } from './format';
import type { Operator, RechargeType } from './types';

export const BULK_MAX = 200;

export type BulkRow = {
  key: string;
  number: string;
  operator: Operator | null;
  type: RechargeType;
  amount: number | null;
};

const ALIASES: Record<string, Operator> = {
  gp: 'GP', grameenphone: 'GP', grameen: 'GP',
  rb: 'RB', robi: 'RB',
  at: 'AT', airtel: 'AT',
  bl: 'BL', banglalink: 'BL',
  tt: 'TT', teletalk: 'TT',
  sk: 'SK', skitto: 'SK',
  bt: 'BT', brilliant: 'BT',
  ry: 'RY', ryze: 'RY',
};
const TYPES: Record<string, RechargeType> = { prepaid: 'prepaid', postpaid: 'postpaid', pre: 'prepaid', post: 'postpaid' };

let seq = 0;
export const rowKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

export const newRow = (r: Omit<BulkRow, 'key' | 'type'> & { type?: RechargeType }): BulkRow => ({
  key: rowKey(),
  type: 'prepaid',
  ...r,
  operator: r.operator ?? detectOperator(r.number),
});

/**
 * One row from loose cells: `number amount`, `operator number amount`, any order,
 * optionally with prepaid/postpaid. Returns null for a header or blank line.
 */
export function parseCells(cells: unknown[]): BulkRow | null {
  const tokens = cells
    .flatMap((c) => (c == null ? [] : String(c).split(/[\s,;\t]+/)))
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) return null;

  let number: string | null = null;
  let amount: number | null = null;
  let operator: Operator | null = null;
  let type: RechargeType = 'prepaid';
  let words = 0;
  for (const t of tokens) {
    const low = t.toLowerCase().replace(/[^a-z]/g, '');
    if (low && ALIASES[low] && !/\d/.test(t)) operator = ALIASES[low];
    else if (low && TYPES[low] && !/\d/.test(t)) type = TYPES[low];
    else if (/\d/.test(t) && /^[^a-z]*(tk|taka)?$/i.test(t)) {
      const digits = t.replace(/\D/g, '');
      if (!number && digits.length >= 10) number = cleanNumber(t);
      else if (amount == null) amount = Number(t.replace(/[^\d.]/g, ''));
    } else words++;
  }
  // "Number, Amount" headers and other text-only lines
  if (!number && amount == null) return null;
  if (words > 0 && !number) return null;
  return newRow({ number: number ?? '', amount, operator, type });
}

export function parseText(text: string) {
  const rows: BulkRow[] = [];
  let skipped = 0;
  let first = true;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const r = parseCells([line]);
    if (r) rows.push(r);
    else if (!first) skipped++; // a first line that isn't a number is a header
    first = false;
  }
  return { rows, skipped };
}

/** What's wrong with a row, or null. `limit` is the per-recharge limit (null = none). */
export function rowError(r: BulkRow, limit: number | null): string | null {
  if (!PHONE_REGEX.test(r.number)) return 'Number must be 11 digits starting with 013–019';
  if (!r.operator) return 'Choose the operator';
  if (r.amount == null || Number.isNaN(r.amount)) return 'Enter an amount';
  if (!Number.isInteger(r.amount)) return 'Use whole taka only';
  if (r.amount < MIN_AMOUNT) return `Minimum is ${taka(MIN_AMOUNT)}`;
  if (limit != null && r.amount > limit) return `Over your ${taka(limit)} limit`;
  return null;
}

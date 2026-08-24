import type { ExceptionStatus, ExceptionType } from '../types';

export const EXCEPTION_TYPE_ORDER: ExceptionType[] = [
  'unmatched',
  'amount_mismatch',
  'duplicate_candidate',
  'missing_invoice',
  'missing_settlement',
  'short_pay',
  'deduction',
  'date_mismatch',
  'ambiguous_match',
];

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  unmatched: 'Unmatched',
  amount_mismatch: 'Amount mismatch',
  duplicate_candidate: 'Duplicate candidate',
  missing_invoice: 'Missing invoice',
  missing_settlement: 'Missing settlement',
  short_pay: 'Short-pay',
  deduction: 'Deduction',
  date_mismatch: 'Date mismatch',
  ambiguous_match: 'Ambiguous match',
};

export const EXCEPTION_TYPE_DOT: Record<ExceptionType, string> = {
  unmatched: 'bg-zinc-400',
  amount_mismatch: 'bg-red-500',
  duplicate_candidate: 'bg-amber-500',
  missing_invoice: 'bg-sky-500',
  missing_settlement: 'bg-red-700',
  short_pay: 'bg-orange-500',
  deduction: 'bg-violet-500',
  date_mismatch: 'bg-yellow-500',
  ambiguous_match: 'bg-fuchsia-500',
};

export const EXCEPTION_STATUS_LABELS: Record<ExceptionStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
};

export function exceptionStatusClasses(status: ExceptionStatus): string {
  switch (status) {
    case 'open':
      return 'bg-red-50 text-red-700 ring-red-200';
    case 'in_review':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'resolved':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
}

const CAUSE_LABELS: Record<string, string> = {
  fee_line: 'Fee',
  deduction_line: 'Deduction',
  refund_line: 'Refund',
  line_alignment: 'Line alignment',
  directional_gap: 'Directional gap',
  no_supported_cause: 'No supported cause',
};

export function causeLabel(causeType: string): string {
  return CAUSE_LABELS[causeType] ?? causeType;
}

export function isSupportedCause(causeType: string): boolean {
  return causeType !== 'no_supported_cause';
}

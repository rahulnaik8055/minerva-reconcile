import type { BadgeTone } from '@/components/ui/badge';
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

export const EXCEPTION_TYPE_TONE: Record<ExceptionType, BadgeTone> = {
  unmatched: 'neutral',
  amount_mismatch: 'danger',
  duplicate_candidate: 'warning',
  missing_invoice: 'info',
  missing_settlement: 'danger',
  short_pay: 'warning',
  deduction: 'info',
  date_mismatch: 'neutral',
  ambiguous_match: 'warning',
};

export const EXCEPTION_STATUS_LABELS: Record<ExceptionStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
};

export const EXCEPTION_STATUS_TONE: Record<ExceptionStatus, BadgeTone> = {
  open: 'danger',
  in_review: 'warning',
  resolved: 'success',
};

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

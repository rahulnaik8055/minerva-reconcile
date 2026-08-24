export type SettlementLineType =
  | 'sale'
  | 'fee'
  | 'refund'
  | 'deduction'
  | 'adjustment'
  | 'reserve'
  | 'other';

export interface SettlementLineInput {
  id: string;
  type: SettlementLineType;
  description: string;
  amountCents: number;
  reference: string | null;
}

export interface SettlementHeaderInput {
  id: string;
  provider: string;
  settlementReference: string | null;
  settlementDate: Date;
  currency: string;
}

export interface SettlementExpectation {
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  deductionsCents: number;
  adjustmentsCents: number;
  expectedNetCents: number;
  lineCount: number;
}

export type SettlementOutcomeType =
  | 'exact_settlement_match'
  | 'short_pay'
  | 'excess_payment'
  | 'fee_variance'
  | 'deduction'
  | 'refund'
  | 'missing_settlement'
  | 'unexplained_variance';

export type SettlementCauseType =
  | 'fee_line'
  | 'deduction_line'
  | 'refund_line'
  | 'line_alignment'
  | 'directional_gap'
  | 'no_supported_cause';

export interface SupportedCause {
  causeType: SettlementCauseType;
  description: string;
  settlementLineId?: string;
  amountCents?: number;
}

export interface SettlementEvidenceEntry {
  label: string;
  detail: string;
}

export interface SettlementReconciliationItem {
  settlementId: string;
  settlementReference: string | null;
  provider: string;
  currency: string;
  outcome: SettlementOutcomeType;
  ambiguous: boolean;
  expectedAmountCents: number;
  actualAmountCents: number | null;
  varianceCents: number | null;
  expectation: SettlementExpectation;
  settlementLines: SettlementLineInput[];
  relatedBankTransactionId: string | null;
  possibleCauses: SupportedCause[];
  evidence: SettlementEvidenceEntry[];
  explanation: string;
  exceptionRaised: boolean;
}

export interface SettlementReconciliationReport {
  items: SettlementReconciliationItem[];
  exceptionCount: number;
  exactMatchCount: number;
  missingSettlementCount: number;
}

export interface SettlementReconciliationConfig {
  varianceAbsoluteToleranceCents: number;
  attributionToleranceCents: number;
  amountLinkTolerancePercentBps: number;
  dateWindowDays: number;
  materialityPercentBps: number;
}

export const DEFAULT_SETTLEMENT_RECONCILIATION_CONFIG: SettlementReconciliationConfig = {
  varianceAbsoluteToleranceCents: 0,
  attributionToleranceCents: 0,
  amountLinkTolerancePercentBps: 50,
  dateWindowDays: 5,
  materialityPercentBps: 1000,
};

export function resolveSettlementReconciliationConfig(
  overrides?: Partial<SettlementReconciliationConfig>,
): SettlementReconciliationConfig {
  return { ...DEFAULT_SETTLEMENT_RECONCILIATION_CONFIG, ...overrides };
}

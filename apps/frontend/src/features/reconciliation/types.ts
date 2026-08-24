export type ProposalStatus = 'pending' | 'accepted' | 'rejected';
export type WorklistItemStatus = ProposalStatus | 'unmatched';
export type WorklistFilter = 'all' | ProposalStatus | 'unmatched';

export interface ReviewSummary {
  totalProposals: number;
  pending: number;
  accepted: number;
  rejected: number;
  overridden: number;
  unmatchedBankTransactions: number;
  unresolvedValueCents: string;
  totalBankTransactions: number;
}

export interface WorklistItem {
  key: string;
  kind: 'proposal' | 'unmatched';
  proposalId: string | null;
  bankTransactionId: string;
  status: WorklistItemStatus;
  method: string | null;
  score: number | null;
  decidedAt: string | null;
  decidedBy: string | null;
  rationaleText: string | null;
  date: string;
  description: string;
  vendor: string;
  amountCents: number;
  currency: string;
  reference: string | null;
  bestMatch: { sourceType: string; label: string } | null;
  evidenceCount: number;
}

export interface WorklistPage {
  items: WorklistItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProposalSource {
  sourceType: string;
  recordId: string;
}

export interface EvidenceEntry {
  id: string;
  sourceType: string;
  sourceId: string;
  evidenceType: string;
  detail: string;
}

export interface HydratedSource extends ProposalSource {
  date: string | null;
  amountCents: number | null;
  currency: string | null;
  vendor: string | null;
  description: string | null;
  reference: string | null;
  importFilename: string | null;
  sourceRow: number | null;
}

export interface ProposalSummary {
  id: string;
  status: string;
  method: string;
  score: number;
  rationale: unknown;
  sources: ProposalSource[];
  createdAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  supersededBy: string | null;
}

export interface ProposalDetail extends ProposalSummary {
  evidence: EvidenceEntry[];
  hydratedSources: HydratedSource[];
}

export interface CandidateSignal {
  name: string;
  tier: string;
  score: number;
  detail: string;
}

export interface CandidateOption {
  sourceType: string;
  recordId: string;
  label: string;
  amountCents: number;
  currency: string;
  score: number;
  classification: string;
  method: string;
  alreadyLinked: boolean;
  signals: CandidateSignal[];
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: {
    previousState?: unknown;
    newState?: unknown;
    reason?: string | null;
    [key: string]: unknown;
  } | null;
  previousHash: string;
  hash: string;
}

export interface ChainVerification {
  valid: boolean;
  checkedCount: number;
  brokenAtIndex: number | null;
  reason: string | null;
}

export interface ActivityFeed {
  entries: ActivityEntry[];
  verification: ChainVerification;
}

export const EXCEPTION_TYPES = [
  'unmatched',
  'amount_mismatch',
  'duplicate_candidate',
  'missing_invoice',
  'missing_settlement',
  'short_pay',
  'deduction',
  'date_mismatch',
  'ambiguous_match',
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export type ExceptionStatus = 'open' | 'in_review' | 'resolved';

export interface ExceptionRelatedRecord {
  sourceType: string;
  recordId: string;
  label: string;
}

export interface ExceptionCause {
  causeType: string;
  description: string;
  amountCents: number | null;
  target: ExceptionRelatedRecord | null;
}

export interface ExceptionEvidence {
  label: string;
  detail: string;
  target: ExceptionRelatedRecord | null;
}

export interface SettlementLineDto {
  id: string;
  type: string;
  description: string;
  amountCents: number;
  reference: string | null;
}

export interface SettlementBreakdown {
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  deductionsCents: number;
  adjustmentsCents: number;
  expectedNetCents: number;
  lines: SettlementLineDto[];
}

export interface ExceptionItem {
  id: string;
  family: 'settlement' | 'proposal';
  exceptionType: ExceptionType;
  title: string;
  detail: string | null;
  date: string;
  amountCents: number;
  currency: string;
  varianceCents: number | null;
  confidence: number | null;
  status: ExceptionStatus;
  outcome: string | null;
  provider: string | null;
  settlementReference: string | null;
  proposalId: string | null;
  proposalStatus: string | null;
  relatedRecords: ExceptionRelatedRecord[];
  causes: ExceptionCause[];
  evidence: ExceptionEvidence[];
  explanation: string | null;
  settlement: SettlementBreakdown | null;
}

export type ExceptionTypeCounts = Record<ExceptionType, number>;

export interface ExceptionsResponse {
  items: ExceptionItem[];
  counts: ExceptionTypeCounts;
  exceptionCount: number;
  exactMatchCount: number;
  missingSettlementCount: number;
  totalSettlements: number;
}

export interface RecordDetail {
  sourceType: string;
  recordId: string;
  title: string;
  subtitle: string | null;
  fields: Array<{ label: string; value: string }>;
  importFilename: string | null;
  sourceRow: number | null;
  parent: { sourceType: string; recordId: string; label: string } | null;
  relatedProposals: Array<{ id: string; status: string }>;
}

export interface DecisionResult {
  proposal: ProposalSummary;
  activity: ActivityEntry[];
}

export interface OverrideResult {
  proposal: ProposalSummary;
  supersededProposalId: string;
  activity: ActivityEntry[];
}

export interface ImportSummary {
  filename: string;
  type: string;
  rowCount: number;
  importedCount: number;
  rejectedCount: number;
  errors: Array<{ row: number; message: string }>;
}

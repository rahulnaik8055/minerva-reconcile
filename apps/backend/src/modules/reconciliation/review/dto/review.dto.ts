import { z } from 'zod';

export const PROPOSAL_STATUSES = ['pending', 'accepted', 'rejected'] as const;

export const WORKLIST_STATUSES = ['all', ...PROPOSAL_STATUSES, 'unmatched'] as const;

export const CANDIDATE_SOURCE_TYPES = ['ledger_entry', 'invoice', 'settlement'] as const;

export const proposalIdParamSchema = z.string().uuid('proposalId must be a valid UUID');

export const approveProposalSchema = z
  .object({
    note: z.string().trim().min(3, 'note must be at least 3 characters').max(2000).optional(),
  })
  .strict();
export type ApproveProposalInput = z.infer<typeof approveProposalSchema>;

export const rejectProposalSchema = z
  .object({
    reason: z.string().trim().min(3, 'reason must be at least 3 characters').max(2000),
  })
  .strict();
export type RejectProposalInput = z.infer<typeof rejectProposalSchema>;

const candidateSelection = {
  candidateSourceType: z.enum(CANDIDATE_SOURCE_TYPES).optional(),
  candidateRecordId: z.string().uuid().optional(),
};

export const overrideProposalSchema = z
  .object({ reason: z.string().trim().min(3, 'reason must be at least 3 characters').max(2000), ...candidateSelection })
  .strict()
  .refine(
    (value) => (value.candidateSourceType === undefined) === (value.candidateRecordId === undefined),
    { message: 'candidateSourceType and candidateRecordId must be provided together' },
  );
export type OverrideProposalInput = z.infer<typeof overrideProposalSchema>;

export const listProposalsQuerySchema = z.object({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;

export const worklistQuerySchema = z.object({
  status: z.enum(WORKLIST_STATUSES).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type WorklistQuery = z.infer<typeof worklistQuerySchema>;

export const listActivityQuerySchema = z.object({
  entityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;

export interface ProposalSourceDto {
  sourceType: string;
  recordId: string;
}

export interface HydratedSourceDto extends ProposalSourceDto {
  date: string | null;
  amountCents: number | null;
  currency: string | null;
  vendor: string | null;
  description: string | null;
  reference: string | null;
  importFilename: string | null;
  sourceRow: number | null;
}

export interface CandidateOptionDto {
  sourceType: string;
  recordId: string;
  label: string;
  amountCents: number;
  currency: string;
  score: number;
  classification: string;
  method: string;
  alreadyLinked: boolean;
  signals: Array<{ name: string; tier: string; score: number; detail: string }>;
}

export interface ReviewSummaryDto {
  totalProposals: number;
  pending: number;
  accepted: number;
  rejected: number;
  overridden: number;
  unmatchedBankTransactions: number;
  unresolvedValueCents: string;
  totalBankTransactions: number;
}

export type WorklistItemStatus = 'pending' | 'accepted' | 'rejected' | 'unmatched';

export interface WorklistItemDto {
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

export interface EvidenceEntryDto {
  id: string;
  sourceType: string;
  sourceId: string;
  evidenceType: string;
  detail: string;
}

export interface ProposalSummaryDto {
  id: string;
  status: string;
  method: string;
  score: number;
  rationale: unknown;
  sources: ProposalSourceDto[];
  createdAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  supersededBy: string | null;
}

export interface ProposalDetailDto extends ProposalSummaryDto {
  evidence: EvidenceEntryDto[];
  hydratedSources: HydratedSourceDto[];
}

export interface ActivityEntryDto {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  previousHash: string;
  hash: string;
}

export interface DecisionResultDto {
  proposal: ProposalSummaryDto;
  activity: ActivityEntryDto[];
}

export interface OverrideResultDto {
  proposal: ProposalSummaryDto;
  supersededProposalId: string;
  activity: ActivityEntryDto[];
}

export interface PaginatedProposalsDto {
  items: ProposalSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ChainVerificationDto {
  valid: boolean;
  checkedCount: number;
  brokenAtIndex: number | null;
  reason: string | null;
}

export interface ActivityFeedDto {
  entries: ActivityEntryDto[];
  verification: ChainVerificationDto;
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

export const EXCEPTION_STATUSES = ['open', 'in_review', 'resolved'] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export const RECORD_SOURCE_TYPES = [
  'bank_transaction',
  'ledger_entry',
  'invoice',
  'settlement',
  'settlement_line',
] as const;
export type RecordSourceType = (typeof RECORD_SOURCE_TYPES)[number];

export const recordParamsSchema = z.object({
  sourceType: z.enum(RECORD_SOURCE_TYPES),
  recordId: z.string().uuid('recordId must be a valid UUID'),
});
export type RecordParams = z.infer<typeof recordParamsSchema>;

export interface ExceptionRelatedRecordDto {
  sourceType: string;
  recordId: string;
  label: string;
}

export interface ExceptionCauseDto {
  causeType: string;
  description: string;
  amountCents: number | null;
  target: ExceptionRelatedRecordDto | null;
}

export interface ExceptionEvidenceDto {
  label: string;
  detail: string;
  target: ExceptionRelatedRecordDto | null;
}

export interface SettlementLineDto {
  id: string;
  type: string;
  description: string;
  amountCents: number;
  reference: string | null;
}

export interface SettlementBreakdownDto {
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  deductionsCents: number;
  adjustmentsCents: number;
  expectedNetCents: number;
  lines: SettlementLineDto[];
}

export interface ExceptionItemDto {
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
  relatedRecords: ExceptionRelatedRecordDto[];
  causes: ExceptionCauseDto[];
  evidence: ExceptionEvidenceDto[];
  explanation: string | null;
  settlement: SettlementBreakdownDto | null;
}

export type ExceptionTypeCounts = Record<ExceptionType, number>;

export interface ExceptionsResponseDto {
  items: ExceptionItemDto[];
  counts: ExceptionTypeCounts;
  exceptionCount: number;
  exactMatchCount: number;
  missingSettlementCount: number;
  totalSettlements: number;
}

export interface RecordFieldDto {
  label: string;
  value: string;
}

export interface RecordDetailDto {
  sourceType: RecordSourceType;
  recordId: string;
  title: string;
  subtitle: string | null;
  fields: RecordFieldDto[];
  importFilename: string | null;
  sourceRow: number | null;
  parent: { sourceType: string; recordId: string; label: string } | null;
  relatedProposals: Array<{ id: string; status: string }>;
}

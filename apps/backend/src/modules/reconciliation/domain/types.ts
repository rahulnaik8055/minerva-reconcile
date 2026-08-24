export type CandidateSourceType = 'ledger_entry' | 'invoice' | 'settlement';

export interface BankTransactionRecord {
  id: string;
  externalReference: string | null;
  postedAt: Date;
  amountCents: number;
  currency: string;
  description: string;
  normalizedVendor: string;
}

export interface LedgerEntryRecord {
  id: string;
  externalReference: string | null;
  postedAt: Date;
  amountCents: number;
  currency: string;
  accountCode: string;
  accountName: string;
  description: string;
  normalizedVendor: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date | null;
  amountCents: number;
  currency: string;
  vendor: string;
  normalizedVendor: string;
  reference: string | null;
}

export interface SettlementRecord {
  id: string;
  provider: string;
  settlementReference: string | null;
  settlementDate: Date;
  currency: string;
  expectedNetCents: number;
}

export type CandidateRecord =
  | { sourceType: 'ledger_entry'; record: LedgerEntryRecord }
  | { sourceType: 'invoice'; record: InvoiceRecord }
  | { sourceType: 'settlement'; record: SettlementRecord };

export type SignalName = 'amount' | 'reference' | 'vendor' | 'date';

export type AmountTier = 'exact' | 'offsetting_exact' | 'within_tolerance' | 'mismatch';
export type ReferenceTier = 'exact' | 'partial' | 'absent' | 'mismatch';
export type VendorTier = 'normalized_exact' | 'token_subset' | 'fuzzy' | 'absent' | 'mismatch';
export type DateTier = 'same_day' | 'within_2_days' | 'within_5_days' | 'outside_window';

export interface SignalAssessment {
  name: SignalName;
  score: number;
  tier: AmountTier | ReferenceTier | VendorTier | DateTier;
  detail: string;
  applicable: boolean;
  matched: boolean;
}

export interface FeatureScore {
  name: SignalName;
  weight: number;
  score: number;
  tier: string;
  detail: string;
}

export type MatchClassification = 'strong_match' | 'needs_review' | 'weak_unmatched';
export type ProposalMethod = 'exact' | 'rule' | 'fuzzy';

export interface ReconciliationProposal {
  bankTransactionId: string;
  sourceType: CandidateSourceType;
  sourceId: string;
  score: number;
  method: ProposalMethod;
  classification: MatchClassification;
  status: 'pending';
  ambiguous: boolean;
  features: FeatureScore[];
  matchedFields: SignalName[];
  mismatchedFields: SignalName[];
  sourceRecords: {
    bankTransaction: BankTransactionRecord;
    candidate: CandidateRecord['record'];
    candidateType: CandidateSourceType;
  };
  evidenceSummary: string;
}

export interface ReconciliationResult {
  proposals: ReconciliationProposal[];
  unmatchedBankTransactionIds: string[];
}

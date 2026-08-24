export { DEFAULT_MATCH_CONFIG, classifyScore, resolveMatchConfig } from './config';
export type {
  AmountToleranceConfig,
  ClassificationThresholds,
  DateScoreConfig,
  DateWindowConfig,
  DeepPartial,
  MatchConfig,
  MatchWeights,
} from './config';
export { generateProposals } from './engine';
export type { ReconciliationInput } from './engine';
export { levenshteinDistance, similarityRatio } from './similarity';
export {
  formatCents,
  scoreAmount,
  scoreDate,
  scoreReference,
  scoreVendor,
} from './signals';
export type {
  BankTransactionRecord,
  CandidateRecord,
  CandidateSourceType,
  DateTier,
  FeatureScore,
  InvoiceRecord,
  LedgerEntryRecord,
  MatchClassification,
  ProposalMethod,
  ReconciliationProposal,
  ReconciliationResult,
  ReferenceTier,
  SettlementRecord,
  SignalAssessment,
  SignalName,
  VendorTier,
  AmountTier,
} from './types';

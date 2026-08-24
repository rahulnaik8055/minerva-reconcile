import { classifyScore, resolveMatchConfig } from './config';
import type { DeepPartial, MatchConfig } from './config';
import { scoreAmount, scoreDate, scoreReference, scoreVendor } from './signals';
import type {
  BankTransactionRecord,
  CandidateRecord,
  FeatureScore,
  InvoiceRecord,
  LedgerEntryRecord,
  ProposalMethod,
  ReconciliationProposal,
  ReconciliationResult,
  SettlementRecord,
  SignalAssessment,
  SignalName,
} from './types';

export interface ReconciliationInput {
  bankTransactions: BankTransactionRecord[];
  ledgerEntries: LedgerEntryRecord[];
  invoices: InvoiceRecord[];
  settlements: SettlementRecord[];
}

interface ScoredPair {
  bankTransaction: BankTransactionRecord;
  candidateRecord: CandidateRecord;
  signals: SignalAssessment[];
  score: number;
}

const SIGNAL_ORDER: SignalName[] = ['amount', 'reference', 'vendor', 'date'];

export function generateProposals(
  input: ReconciliationInput,
  configOverrides?: DeepPartial<MatchConfig>,
): ReconciliationResult {
  const config = resolveMatchConfig(configOverrides);
  const scoredPairs: ScoredPair[] = [];

  for (const bankTransaction of input.bankTransactions) {
    for (const candidateRecord of buildCandidates(input)) {
      if (!currenciesCompatible(bankTransaction.currency, candidateCurrency(candidateRecord))) {
        continue;
      }

      const pair = evaluatePair(bankTransaction, candidateRecord, config);

      if (pair) {
        scoredPairs.push(pair);
      }
    }
  }

  const proposals = scoredPairs
    .map((pair) => toProposal(pair, config))
    .filter((proposal) => classifyScore(proposal.score, config) !== 'weak_unmatched');

  markAmbiguousProposals(proposals, config);

  const matchedBankIds = new Set(proposals.map((proposal) => proposal.bankTransactionId));
  const unmatchedBankTransactionIds = input.bankTransactions
    .map((bankTransaction) => bankTransaction.id)
    .filter((id) => !matchedBankIds.has(id));

  proposals.sort((left, right) => right.score - left.score);

  return { proposals, unmatchedBankTransactionIds };
}

function buildCandidates(input: ReconciliationInput): CandidateRecord[] {
  return [
    ...input.ledgerEntries.map(
      (record): CandidateRecord => ({ sourceType: 'ledger_entry', record }),
    ),
    ...input.invoices.map((record): CandidateRecord => ({ sourceType: 'invoice', record })),
    ...input.settlements.map((record): CandidateRecord => ({ sourceType: 'settlement', record })),
  ];
}

function currenciesCompatible(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function candidateCurrency(candidate: CandidateRecord): string {
  return candidate.record.currency;
}

function candidateReference(candidate: CandidateRecord): string | null {
  switch (candidate.sourceType) {
    case 'ledger_entry':
      return candidate.record.externalReference;
    case 'invoice':
      return candidate.record.reference ?? candidate.record.invoiceNumber;
    case 'settlement':
      return candidate.record.settlementReference;
  }
}

function candidateVendor(candidate: CandidateRecord): string {
  switch (candidate.sourceType) {
    case 'ledger_entry':
      return candidate.record.normalizedVendor;
    case 'invoice':
      return candidate.record.vendor;
    case 'settlement':
      return candidate.record.provider;
  }
}

function candidateDate(candidate: CandidateRecord): Date {
  switch (candidate.sourceType) {
    case 'ledger_entry':
      return candidate.record.postedAt;
    case 'invoice':
      return candidate.record.issuedAt;
    case 'settlement':
      return candidate.record.settlementDate;
  }
}

function candidateAmount(candidate: CandidateRecord): { amountCents: number; label: string } {
  switch (candidate.sourceType) {
    case 'ledger_entry':
      return { amountCents: candidate.record.amountCents, label: 'ledger entry' };
    case 'invoice':
      return { amountCents: candidate.record.amountCents, label: 'invoice' };
    case 'settlement':
      return { amountCents: candidate.record.expectedNetCents, label: 'settlement net' };
  }
}

function evaluatePair(
  bankTransaction: BankTransactionRecord,
  candidateRecord: CandidateRecord,
  config: MatchConfig,
): ScoredPair | null {
  const amount = candidateAmount(candidateRecord);
  const amountSignal = scoreAmount(bankTransaction.amountCents, amount, config);
  const referenceSignal = scoreReference(bankTransaction.externalReference, candidateReference(candidateRecord));
  const vendorSignal = scoreVendor(bankTransaction.normalizedVendor, candidateVendor(candidateRecord), config);
  const dateSignal = scoreDate(bankTransaction.postedAt, candidateDate(candidateRecord), config);

  const signals = [amountSignal, referenceSignal, vendorSignal, dateSignal];
  const applicableSignals = signals.filter((signal) => signal.applicable);
  const applicableWeight = applicableSignals.reduce(
    (total, signal) => total + config.weights[signal.name],
    0,
  );

  if (applicableWeight <= 0) {
    return null;
  }

  const weightedSum = applicableSignals.reduce(
    (total, signal) => total + config.weights[signal.name] * signal.score,
    0,
  );
  const score = round4(weightedSum / applicableWeight);

  return { bankTransaction, candidateRecord, signals, score };
}

function toProposal(pair: ScoredPair, config: MatchConfig): ReconciliationProposal {
  const byName = new Map<SignalName, SignalAssessment>(pair.signals.map((s) => [s.name, s]));
  const amount = byName.get('amount');
  const reference = byName.get('reference');
  const vendor = byName.get('vendor');
  const date = byName.get('date');

  const features: FeatureScore[] = SIGNAL_ORDER.map((name) => {
    const signal = byName.get(name) as SignalAssessment;

    return {
      name,
      weight: config.weights[name],
      score: signal.score,
      tier: signal.tier,
      detail: signal.detail,
    };
  });

  return {
    bankTransactionId: pair.bankTransaction.id,
    sourceType: pair.candidateRecord.sourceType,
    sourceId: pair.candidateRecord.record.id,
    score: pair.score,
    method: determineMethod(amount, reference, vendor, date),
    classification: classifyScore(pair.score, config),
    status: 'pending',
    ambiguous: false,
    features,
    matchedFields: pair.signals.filter((s) => s.applicable && s.matched).map((s) => s.name),
    mismatchedFields: pair.signals.filter((s) => s.applicable && !s.matched).map((s) => s.name),
    sourceRecords: {
      bankTransaction: pair.bankTransaction,
      candidate: pair.candidateRecord.record,
      candidateType: pair.candidateRecord.sourceType,
    },
    evidenceSummary: buildEvidenceSummary(pair, config),
  };
}

type MaybeSignal = SignalAssessment | undefined;

function determineMethod(
  amount: MaybeSignal,
  reference: MaybeSignal,
  vendor: MaybeSignal,
  date: MaybeSignal,
): ProposalMethod {
  if (!amount || !reference || !vendor || !date) {
    return 'rule';
  }

  if (vendor.tier === 'fuzzy') {
    return 'fuzzy';
  }

  const amountExact = amount.tier === 'exact' || amount.tier === 'offsetting_exact';
  const dateNear = date.tier === 'same_day' || date.tier === 'within_2_days';

  if (amountExact && vendor.tier === 'normalized_exact' && reference.tier === 'exact' && dateNear) {
    return 'exact';
  }

  return 'rule';
}

function markAmbiguousProposals(proposals: ReconciliationProposal[], config: MatchConfig): void {
  const byBank = new Map<string, ReconciliationProposal[]>();

  for (const proposal of proposals) {
    const group = byBank.get(proposal.bankTransactionId) ?? [];
    group.push(proposal);
    byBank.set(proposal.bankTransactionId, group);
  }

  for (const group of byBank.values()) {
    if (group.length < 2) {
      continue;
    }

    const topScore = Math.max(...group.map((proposal) => proposal.score));
    const leaders = group.filter(
      (proposal) => topScore - proposal.score <= config.ambiguityEpsilon,
    );

    if (leaders.length < 2) {
      continue;
    }

    for (const leader of leaders) {
      leader.ambiguous = true;
    }
  }
}

function buildEvidenceSummary(pair: ScoredPair, config: MatchConfig): string {
  const signalText = pair.signals
    .map((signal) => `${signal.name}: ${signal.detail}`)
    .join('; ');
  const weightText = SIGNAL_ORDER.map((name) => {
    const percent = Math.round(config.weights[name] * 100);

    return `${name} ${percent}%`;
  }).join(', ');

  return (
    `Proposed ${candidateAmount(pair.candidateRecord).label} ${pair.candidateRecord.record.id} ` +
    `for bank transaction ${pair.bankTransaction.id}. Signals - ${signalText}. ` +
    `Score ${pair.score.toFixed(2)} from weights: ${weightText}. Human review required before posting.`
  );
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

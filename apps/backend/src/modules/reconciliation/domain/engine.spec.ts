import { resolveMatchConfig } from './config';
import { generateProposals } from './engine';
import type {
  BankTransactionRecord,
  InvoiceRecord,
  LedgerEntryRecord,
  SettlementRecord,
} from './types';

const T0 = Date.UTC(2026, 6, 3);

function dateAt(dayOffset: number): Date {
  return new Date(T0 + dayOffset * 86_400_000);
}

function bank(overrides: Partial<BankTransactionRecord> = {}): BankTransactionRecord {
  return {
    id: 'bank-1',
    externalReference: 'INV1001',
    postedAt: new Date(T0),
    amountCents: -25000,
    currency: 'USD',
    description: 'Card payment ACME OFFICE SUPPLY INC',
    normalizedVendor: 'ACME OFFICE SUPPLY',
    ...overrides,
  };
}

function ledger(overrides: Partial<LedgerEntryRecord> = {}): LedgerEntryRecord {
  return {
    id: 'led-1',
    externalReference: 'INV1001',
    postedAt: new Date(T0),
    amountCents: -25000,
    currency: 'USD',
    accountCode: '6100',
    accountName: 'Office Supplies',
    description: 'Acme supplies purchase',
    normalizedVendor: 'ACME OFFICE SUPPLY',
    ...overrides,
  };
}

function invoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-2087',
    issuedAt: new Date(T0),
    dueAt: null,
    amountCents: 25000,
    currency: 'USD',
    vendor: 'Acme Office Supply Co Ltd',
    normalizedVendor: 'ACME OFFICE SUPPLY',
    reference: null,
    ...overrides,
  };
}

function settlement(overrides: Partial<SettlementRecord> = {}): SettlementRecord {
  return {
    id: 'set-1',
    provider: 'Stripe',
    settlementReference: 'PAYOUT-8891',
    settlementDate: new Date(T0),
    currency: 'USD',
    expectedNetCents: -25000,
    ...overrides,
  };
}

describe('generateProposals', () => {
  it('produces a perfect proposal for an exact ledger match', () => {
    const result = generateProposals({
      bankTransactions: [bank()],
      ledgerEntries: [ledger()],
      invoices: [],
      settlements: [],
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.unmatchedBankTransactionIds).toEqual([]);

    const proposal = result.proposals[0]!;
    expect(proposal.score).toBe(1);
    expect(proposal.classification).toBe('strong_match');
    expect(proposal.method).toBe('exact');
    expect(proposal.status).toBe('pending');
    expect(proposal.ambiguous).toBe(false);
    expect(proposal.matchedFields).toEqual(['amount', 'reference', 'vendor', 'date']);
    expect(proposal.mismatchedFields).toEqual([]);
    expect(proposal.sourceRecords.bankTransaction.id).toBe('bank-1');
    expect(proposal.sourceRecords.candidateType).toBe('ledger_entry');
    expect(proposal.evidenceSummary).toContain('ledger entry led-1');
    expect(proposal.evidenceSummary).toContain('Human review required');
  });

  it('matches vendors after normalization despite different raw spellings', () => {
    const result = generateProposals({
      bankTransactions: [
        bank({ normalizedVendor: 'ACME OFFICE SUPPLY INC', externalReference: 'PO-77' }),
      ],
      ledgerEntries: [],
      invoices: [
        invoice({
          reference: 'po 77',
          normalizedVendor: 'ACME OFFICE SUPPLY CO LTD',
          vendor: 'Acme Office Supply Co Ltd',
        }),
      ],
      settlements: [],
    });

    const proposal = result.proposals[0]!;

    expect(proposal.features.find((f) => f.name === 'vendor')?.score).toBe(1);
    expect(proposal.features.find((f) => f.name === 'vendor')?.detail).toContain(
      'ACME OFFICE SUPPLY',
    );
    expect(proposal.score).toBeCloseTo(1, 5);
  });

  it('scores partial reference overlap below exact and downgrades the method to rule', () => {
    const result = generateProposals({
      bankTransactions: [bank({ externalReference: 'INV10' })],
      ledgerEntries: [ledger({ externalReference: 'INV-1007' })],
      invoices: [],
      settlements: [],
    });

    const proposal = result.proposals[0]!;
    const referenceFeature = proposal.features.find((f) => f.name === 'reference');

    expect(referenceFeature?.tier).toBe('partial');
    expect(referenceFeature?.score).toBe(0.5);
    expect(referenceFeature?.detail).toContain('Partial reference overlap');
    expect(proposal.score).toBeCloseTo(0.875, 5);
    expect(proposal.classification).toBe('needs_review');
    expect(proposal.method).toBe('rule');
  });

  it('applies date tolerance with transparent detail for a 3 day gap', () => {
    const result = generateProposals({
      bankTransactions: [bank({ postedAt: dateAt(3) })],
      ledgerEntries: [ledger()],
      invoices: [],
      settlements: [],
    });

    const proposal = result.proposals[0]!;
    const dateFeature = proposal.features.find((f) => f.name === 'date');

    expect(dateFeature?.score).toBe(0.8);
    expect(dateFeature?.detail).toBe('3 days apart');
    expect(proposal.score).toBeCloseTo(0.97, 5);
    expect(proposal.classification).toBe('strong_match');
    expect(proposal.method).toBe('rule');
  });

  it('accepts amounts within configured tolerance without treating them as exact', () => {
    const result = generateProposals({
      bankTransactions: [bank({ amountCents: -25080 })],
      ledgerEntries: [ledger()],
      invoices: [],
      settlements: [],
    });

    const proposal = result.proposals[0]!;
    const amountFeature = proposal.features.find((f) => f.name === 'amount');

    expect(amountFeature?.tier).toBe('within_tolerance');
    expect(amountFeature?.score).toBe(0.85);
    expect(amountFeature?.detail).toContain('within the configured tolerance');
    expect(proposal.score).toBeCloseTo(0.94, 5);
    expect(proposal.matchedFields).toContain('amount');
    expect(proposal.method).toBe('rule');
  });

  it('classifies mixed weak signals as needing review', () => {
    const result = generateProposals({
      bankTransactions: [
        bank({ externalReference: null, normalizedVendor: 'INITECH CONSULTING', postedAt: dateAt(4) }),
      ],
      ledgerEntries: [ledger({ externalReference: 'INV1001' })],
      invoices: [],
      settlements: [],
    });

    expect(result.proposals).toHaveLength(1);

    const proposal = result.proposals[0]!;

    expect(proposal.score).toBeCloseTo(0.6933, 4);
    expect(proposal.classification).toBe('needs_review');
    expect(proposal.mismatchedFields).toEqual(['vendor']);
    expect(proposal.matchedFields).toEqual(['amount', 'date']);
    expect(proposal.features.find((f) => f.name === 'reference')?.tier).toBe('absent');
  });

  it('ranks multiple candidates best first and keeps them unambiguous', () => {
    const result = generateProposals({
      bankTransactions: [bank()],
      ledgerEntries: [
        ledger({ id: 'led-strong' }),
        ledger({
          id: 'led-weaker',
          externalReference: 'INV1002',
          postedAt: dateAt(3),
        }),
      ],
      invoices: [],
      settlements: [],
    });

    expect(result.proposals).toHaveLength(2);
    expect(result.proposals.every((p) => !p.ambiguous)).toBe(true);
    expect(result.proposals[0]?.sourceId).toBe('led-strong');
    expect(result.proposals[0]?.score).toBeGreaterThan(result.proposals[1]!.score);
    expect(result.unmatchedBankTransactionIds).toEqual([]);
  });

  it('flags duplicate candidates so reviewers see the ambiguity', () => {
    const result = generateProposals({
      bankTransactions: [bank({ externalReference: 'INV-2087' })],
      ledgerEntries: [],
      invoices: [
        invoice({ id: 'inv-dup-a' }),
        invoice({ id: 'inv-dup-b', vendor: 'Acme Office Supply Co Ltd' }),
      ],
      settlements: [],
    });

    expect(result.proposals).toHaveLength(2);

    const scores = result.proposals.map((p) => p.score);

    expect(scores[0]).toBe(scores[1]);
    expect(result.proposals.every((p) => p.ambiguous)).toBe(true);
  });

  it('returns no proposals when there is nothing to match', () => {
    const result = generateProposals({
      bankTransactions: [bank()],
      ledgerEntries: [],
      invoices: [],
      settlements: [],
    });

    expect(result.proposals).toEqual([]);
    expect(result.unmatchedBankTransactionIds).toEqual(['bank-1']);
  });

  it('ignores candidates in other currencies entirely', () => {
    const result = generateProposals({
      bankTransactions: [bank()],
      ledgerEntries: [ledger({ currency: 'EUR' })],
      invoices: [],
      settlements: [],
    });

    expect(result.proposals).toEqual([]);
    expect(result.unmatchedBankTransactionIds).toEqual(['bank-1']);
  });

  it('marks distinct equally scoring candidates from different sources as ambiguous', () => {
    const result = generateProposals({
      bankTransactions: [bank()],
      ledgerEntries: [ledger({ id: 'led-tie' })],
      invoices: [invoice({ id: 'inv-tie', reference: 'INV-1001' })],
      settlements: [],
    });

    expect(result.proposals).toHaveLength(2);
    expect(result.proposals.map((p) => p.sourceType).sort()).toEqual(['invoice', 'ledger_entry']);
    expect(result.proposals.every((p) => p.ambiguous)).toBe(true);
  });

  it('never emits weak matches as pending proposals', () => {
    const result = generateProposals({
      bankTransactions: [
        bank({ externalReference: 'ZZZ999', normalizedVendor: 'INITECH CONSULTING', postedAt: dateAt(30) }),
      ],
      ledgerEntries: [ledger()],
      invoices: [],
      settlements: [],
    });

    expect(result.proposals).toEqual([]);
    expect(result.unmatchedBankTransactionIds).toEqual(['bank-1']);
  });

  it('honors configurable weights when ranking', () => {
    const result = generateProposals(
      {
        bankTransactions: [bank({ postedAt: dateAt(3) })],
        ledgerEntries: [ledger()],
        invoices: [],
        settlements: [],
      },
      { weights: { date: 0 } },
    );

    const proposal = result.proposals[0]!;

    expect(resolveMatchConfig().weights.date).toBe(0.15);
    expect(proposal.features.find((f) => f.name === 'date')?.weight).toBe(0);
    expect(proposal.score).toBeCloseTo(1, 5);
  });

  it('honors configurable classification thresholds', () => {
    const input = {
      bankTransactions: [bank({ amountCents: -25080 })],
      ledgerEntries: [ledger()],
      invoices: [],
      settlements: [],
    };

    const withDefaultThresholds = generateProposals(input);
    expect(withDefaultThresholds.proposals[0]?.classification).toBe('strong_match');
    expect(withDefaultThresholds.proposals[0]?.score).toBeCloseTo(0.94, 5);

    const withRaisedStrongMin = generateProposals(input, {
      classification: { strongMin: 0.95 },
    });

    expect(withRaisedStrongMin.proposals[0]?.classification).toBe('needs_review');
    expect(withRaisedStrongMin.unmatchedBankTransactionIds).toEqual([]);
  });

  it('proposes offsetting invoice payments with exact method', () => {
    const result = generateProposals({
      bankTransactions: [bank({ externalReference: 'INV-2087', normalizedVendor: 'ACME OFFICE SUPPLY' })],
      ledgerEntries: [],
      invoices: [invoice()],
      settlements: [],
    });

    const proposal = result.proposals[0]!;

    expect(proposal.features.find((f) => f.name === 'amount')?.tier).toBe('offsetting_exact');
    expect(proposal.score).toBe(1);
    expect(proposal.method).toBe('exact');
    expect(proposal.evidenceSummary).toContain('offsetting');
  });

  it('includes settlement nets as candidates using provider as counterparty', () => {
    const result = generateProposals({
      bankTransactions: [
        bank({
          id: 'bank-payout',
          amountCents: -78445,
          externalReference: 'PAYOUT8891',
          normalizedVendor: 'STRIPE',
          postedAt: dateAt(1),
        }),
      ],
      ledgerEntries: [],
      invoices: [],
      settlements: [
        settlement({
          expectedNetCents: 78445,
          settlementDate: dateAt(1),
          provider: 'Stripe Payments',
          settlementReference: 'PAYOUT-8891',
        }),
      ],
    });

    const proposal = result.proposals[0]!;

    expect(proposal.sourceType).toBe('settlement');
    expect(proposal.features.find((f) => f.name === 'vendor')?.tier).toBe('token_subset');
    expect(proposal.classification).toBe('strong_match');
    expect(proposal.status).toBe('pending');
  });

  it('does not mutate input records while generating proposals', () => {
    const bankRecord = bank();
    const ledgerRecord = ledger();
    const snapshot = JSON.stringify({ bankRecord, ledgerRecord });

    generateProposals({
      bankTransactions: [bankRecord],
      ledgerEntries: [ledgerRecord],
      invoices: [],
      settlements: [],
    });

    expect(JSON.stringify({ bankRecord, ledgerRecord })).toBe(snapshot);
  });
});

import type { BankTransactionRecord } from '../types';
import { formatMoney } from './money';
import { computeSettlementExpectation } from './settlement-expectation';
import { reconcileSettlements } from './settlement-reconciler';
import type {
  SettlementHeaderInput,
  SettlementLineInput,
} from './types';

const T0 = Date.UTC(2026, 7, 3);

function settlement(overrides: Partial<SettlementHeaderInput> = {}): SettlementHeaderInput {
  return {
    id: 'set-1',
    provider: 'Stripe',
    settlementReference: 'PAYOUT-8891',
    settlementDate: new Date(T0),
    currency: 'USD',
    ...overrides,
  };
}

function line(overrides: Partial<SettlementLineInput> = {}): SettlementLineInput {
  return {
    id: 'line-sale',
    type: 'sale',
    description: 'Card sales',
    amountCents: 1_520_000,
    reference: null,
    ...overrides,
  };
}

function exampleLines(): SettlementLineInput[] {
  return [
    line({ id: 'line-gross', amountCents: 1_520_000 }),
    line({ id: 'line-fees', type: 'fee', description: 'Processing fees', amountCents: -142_000 }),
    line({ id: 'line-refund', type: 'refund', description: 'Customer refunds', amountCents: -68_000 }),
    line({ id: 'line-deduction', type: 'deduction', description: 'Chargeback', amountCents: -30_000 }),
  ];
}

function bank(overrides: Partial<BankTransactionRecord> = {}): BankTransactionRecord {
  return {
    id: 'bank-9',
    externalReference: 'PAYOUT-8891',
    postedAt: new Date(T0),
    amountCents: 1_280_000,
    currency: 'USD',
    description: 'Stripe payout',
    normalizedVendor: 'STRIPE',
    ...overrides,
  };
}

describe('computeSettlementExpectation', () => {
  it('derives the signed component totals and expected net from lines', () => {
    const expectation = computeSettlementExpectation(exampleLines());

    expect(expectation.grossCents).toBe(1_520_000);
    expect(expectation.feesCents).toBe(-142_000);
    expect(expectation.refundsCents).toBe(-68_000);
    expect(expectation.deductionsCents).toBe(-30_000);
    expect(expectation.adjustmentsCents).toBe(0);
    expect(expectation.expectedNetCents).toBe(1_280_000);
  });

  it('counts reserves and other lines as adjustments', () => {
    const expectation = computeSettlementExpectation([
      line({ amountCents: 500_000 }),
      line({ id: 'reserve', type: 'reserve', description: 'Rolling reserve', amountCents: -50_000 }),
    ]);

    expect(expectation.adjustmentsCents).toBe(-50_000);
    expect(expectation.expectedNetCents).toBe(450_000);
  });
});

describe('formatMoney', () => {
  it('formats cents with thousands separators and explicit signs', () => {
    expect(formatMoney(1_280_000)).toBe('$12,800.00');
    expect(formatMoney(-30_000)).toBe('-$300.00');
    expect(formatMoney(0)).toBe('$0.00');
  });
});

describe('reconcileSettlements', () => {
  it('detects an exact settlement match with no exception', () => {
    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines: exampleLines() }],
      bankTransactions: [bank()],
    });

    expect(report.items).toHaveLength(1);

    const item = report.items[0]!;

    expect(item.outcome).toBe('exact_settlement_match');
    expect(item.exceptionRaised).toBe(false);
    expect(item.varianceCents).toBe(0);
    expect(item.relatedBankTransactionId).toBe('bank-9');
    expect(item.explanation).toContain('No variance detected');
    expect(report.exactMatchCount).toBe(1);
    expect(report.exceptionCount).toBe(0);
  });

  it('attributes a variance to a deduction line and produces the supported explanation', () => {
    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines: exampleLines() }],
      bankTransactions: [bank({ amountCents: 1_250_000 })],
    });

    const item = report.items[0]!;

    expect(item.outcome).toBe('deduction');
    expect(item.expectedAmountCents).toBe(1_280_000);
    expect(item.actualAmountCents).toBe(1_250_000);
    expect(item.varianceCents).toBe(-30_000);
    expect(item.exceptionRaised).toBe(true);
    expect(item.possibleCauses[0]?.causeType).toBe('deduction_line');
    expect(item.possibleCauses[0]?.settlementLineId).toBe('line-deduction');

    expect(item.explanation).toBe(
      'Expected settlement amount was $12,800.00. Bank deposit was $12,500.00. ' +
        'A $300.00 deduction accounts for the difference.',
    );

    expect(item.evidence.some((entry) => entry.detail.includes('matches deduction line line-deduction'))).toBe(true);
    expect(report.exceptionCount).toBe(1);
  });

  it('attributes a variance to processing fees as fee variance', () => {
    const lines = [
      line({ id: 'gross', amountCents: 1_000_000 }),
      line({ id: 'fees', type: 'fee' as const, description: 'Processing fees', amountCents: -20_000 }),
    ];

    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines }],
      bankTransactions: [bank({ amountCents: 960_000 })],
    });

    const item = report.items[0]!;

    expect(item.outcome).toBe('fee_variance');
    expect(item.varianceCents).toBe(-20_000);
    expect(item.possibleCauses[0]?.causeType).toBe('fee_line');
    expect(item.explanation).toContain('A $200.00 fee difference accounts for the difference.');
  });

  it('attributes a variance to a refund line', () => {
    const lines = [
      line({ id: 'gross', amountCents: 500_000 }),
      line({ id: 'refunds', type: 'refund' as const, description: 'Late refund batch', amountCents: -50_000 }),
    ];

    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines }],
      bankTransactions: [bank({ amountCents: 400_000 })],
    });

    const item = report.items[0]!;

    expect(item.outcome).toBe('refund');
    expect(item.varianceCents).toBe(-50_000);
    expect(item.possibleCauses[0]?.settlementLineId).toBe('refunds');
    expect(item.explanation).toContain('A $500.00 refund accounts for the difference.');
  });

  it('flags a short-pay when the deposit is under the expected net without a supporting line', () => {
    const lines = [
      line({ amountCents: 800_000 }),
      line({ id: 'fees', type: 'fee' as const, description: 'Fees', amountCents: -100_000 }),
    ];

    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines }],
      bankTransactions: [bank({ amountCents: 650_000 })],
    });

    const item = report.items[0]!;

    expect(item.outcome).toBe('short_pay');
    expect(item.expectedAmountCents).toBe(700_000);
    expect(item.actualAmountCents).toBe(650_000);
    expect(item.varianceCents).toBe(-50_000);
    expect(item.possibleCauses.some((c) => c.causeType === 'directional_gap')).toBe(true);
    expect(item.explanation).toContain('The deposit is short by $500.00; no settlement line explains the difference.');
  });

  it('raises an unexplained variance beyond materiality even though a deposit exists', () => {
    const lines = [
      line({ amountCents: 800_000 }),
      line({ id: 'fees', type: 'fee' as const, description: 'Fees', amountCents: -20_000 }),
    ];

    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines }],
      bankTransactions: [bank({ amountCents: 600_000, externalReference: 'UNRELATED-REF' })],
    });

    const item = report.items[0]!;

    expect(item.outcome).toBe('unexplained_variance');
    expect(item.varianceCents).toBe(-180_000);
    expect(item.evidence.some((entry) => entry.detail.includes('No settlement line matches'))).toBe(true);
    expect(item.explanation).toContain('is unexplained by the settlement records.');
  });

  it('reports an excess payment when the deposit exceeds expectations within materiality', () => {
    const lines = [
      line({ amountCents: 800_000 }),
      line({ id: 'fees', type: 'fee' as const, description: 'Fees', amountCents: -100_000 }),
    ];

    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines }],
      bankTransactions: [bank({ amountCents: 760_000 })],
    });

    const item = report.items[0]!;

    expect(item.outcome).toBe('excess_payment');
    expect(item.varianceCents).toBe(60_000);
    expect(item.explanation).toContain('exceeds expectations by $600.00');
  });

  it('detects a missing settlement when no bank transaction links at all', () => {
    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines: exampleLines() }],
      bankTransactions: [],
    });

    const item = report.items[0]!;

    expect(item.outcome).toBe('missing_settlement');
    expect(item.actualAmountCents).toBeNull();
    expect(item.varianceCents).toBeNull();
    expect(item.relatedBankTransactionId).toBeNull();
    expect(item.exceptionRaised).toBe(true);
    expect(item.explanation).toBe(
      'No bank transaction was found for this settlement. Expected deposit was $12,800.00.',
    );
    expect(report.missingSettlementCount).toBe(1);
  });

  it('still links deposits that are far off in amount via the payout reference', () => {
    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines: exampleLines() }],
      bankTransactions: [bank({ amountCents: 100_000 })],
    });

    const item = report.items[0]!;

    expect(item.relatedBankTransactionId).toBe('bank-9');
    expect(item.outcome).toBe('unexplained_variance');
    expect(item.varianceCents).toBe(-1_180_000);
  });

  it('links by provider and date when no reference exists on either side', () => {
    const lines = [
      line({ amountCents: 800_000 }),
      line({ id: 'fees', type: 'fee' as const, description: 'Fees', amountCents: -100_000 }),
    ];

    const report = reconcileSettlements({
      settlements: [
        {
          settlement: settlement({ settlementReference: null }),
          lines,
        },
      ],
      bankTransactions: [
        bank({ externalReference: null, normalizedVendor: 'STRIPE PAYMENTS', amountCents: 650_000 }),
      ],
    });

    const item = report.items[0]!;

    expect(item.relatedBankTransactionId).toBe('bank-9');
    expect(item.outcome).toBe('short_pay');
    expect(
      item.evidence.some((entry) => entry.label === 'bank_link' && entry.detail.includes('day(s) apart')),
    ).toBe(true);
  });

  it('never links across currencies', () => {
    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines: exampleLines() }],
      bankTransactions: [bank({ currency: 'EUR' })],
    });

    expect(report.items[0]!.outcome).toBe('missing_settlement');
  });

  it('marks ambiguous links when two deposits tie on the link score', () => {
    const report = reconcileSettlements({
      settlements: [{ settlement: settlement(), lines: exampleLines() }],
      bankTransactions: [
        bank({ id: 'bank-a', amountCents: 1_280_000 }),
        bank({ id: 'bank-b', amountCents: 1_280_000 }),
      ],
    });

    const item = report.items[0]!;

    expect(item.ambiguous).toBe(true);
    expect(['bank-a', 'bank-b']).toContain(item.relatedBankTransactionId);
  });

  it('honors configurable tolerances for exactness', () => {
    const report = reconcileSettlements(
      {
        settlements: [{ settlement: settlement(), lines: exampleLines() }],
        bankTransactions: [bank({ amountCents: 1_280_001 })],
      },
      { varianceAbsoluteToleranceCents: 5 },
    );

    expect(report.items[0]!.outcome).toBe('exact_settlement_match');

    const strict = reconcileSettlements(
      {
        settlements: [{ settlement: settlement(), lines: exampleLines() }],
        bankTransactions: [bank({ amountCents: 1_280_001 })],
      },
      { varianceAbsoluteToleranceCents: 0 },
    );

    expect(strict.items[0]!.outcome).not.toBe('exact_settlement_match');
  });
});

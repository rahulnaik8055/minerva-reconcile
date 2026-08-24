import { normalizeReference, normalizeVendorName } from '../../../imports/lib/normalize';
import type { BankTransactionRecord } from '../types';
import { similarityRatio } from '../similarity';
import { formatMoney } from './money';
import { computeSettlementExpectation } from './settlement-expectation';
import {
  resolveSettlementReconciliationConfig,
  DEFAULT_SETTLEMENT_RECONCILIATION_CONFIG,
} from './types';
import type {
  SettlementCauseType,
  SettlementEvidenceEntry,
  SettlementExpectation,
  SettlementHeaderInput,
  SettlementLineInput,
  SettlementOutcomeType,
  SettlementReconciliationConfig,
  SettlementReconciliationItem,
  SettlementReconciliationReport,
  SupportedCause,
} from './types';

export interface SettlementReconciliationInput {
  settlements: Array<{ settlement: SettlementHeaderInput; lines: SettlementLineInput[] }>;
  bankTransactions: BankTransactionRecord[];
}

interface LinkedBankTransaction {
  bank: BankTransactionRecord;
  linkReason: string;
  ambiguous: boolean;
}

const REFERENCE_LINK_SCORE = 100;
const AMOUNT_LINK_SCORE = 60;
const DATE_LINK_SCORE = 15;
const VENDOR_LINK_SCORE = 10;
const VENDOR_FUZZY_THRESHOLD = 0.82;

export function reconcileSettlements(
  input: SettlementReconciliationInput,
  configOverrides?: Partial<SettlementReconciliationConfig>,
): SettlementReconciliationReport {
  const config =
    configOverrides === undefined
      ? DEFAULT_SETTLEMENT_RECONCILIATION_CONFIG
      : resolveSettlementReconciliationConfig(configOverrides);

  const items = input.settlements.map(({ settlement, lines }) =>
    reconcileOne(settlement, lines, input.bankTransactions, config),
  );

  return {
    items,
    exceptionCount: items.filter((item) => item.exceptionRaised).length,
    exactMatchCount: items.filter((item) => item.outcome === 'exact_settlement_match').length,
    missingSettlementCount: items.filter((item) => item.outcome === 'missing_settlement').length,
  };
}

function reconcileOne(
  settlement: SettlementHeaderInput,
  lines: SettlementLineInput[],
  bankTransactions: BankTransactionRecord[],
  config: SettlementReconciliationConfig,
): SettlementReconciliationItem {
  const expectation = computeSettlementExpectation(lines);
  const evidence: SettlementEvidenceEntry[] = [
    {
      label: 'expected_net_computation',
      detail:
        `Expected net computed from ${lines.length} settlement line(s): ` +
        `gross ${formatMoney(expectation.grossCents)}` +
        ` + fees ${formatMoney(expectation.feesCents)}` +
        ` + refunds ${formatMoney(expectation.refundsCents)}` +
        ` + deductions ${formatMoney(expectation.deductionsCents)}` +
        ` + adjustments/reserves ${formatMoney(expectation.adjustmentsCents)}` +
        ` = ${formatMoney(expectation.expectedNetCents)}`,
    },
  ];

  const linked = findLinkedBankTransaction(settlement, expectation.expectedNetCents, bankTransactions, config);

  if (!linked) {
    evidence.push({
      label: 'bank_link',
      detail:
        `No bank transaction linked to settlement ${settlement.id}: no payout reference match, ` +
        `no provider/date match, and no amount within tolerance dated within ${config.dateWindowDays} day(s)`,
    });

    return assembleItem({
      settlement,
      lines,
      expectation,
      outcome: 'missing_settlement',
      actualAmountCents: null,
      relatedBank: null,
      causes: [
        {
          causeType: 'no_supported_cause',
          description: 'The corresponding bank deposit is not present in the imported records',
        },
        {
          causeType: 'directional_gap',
          description: 'The deposit may be dated outside the matching window or not yet imported',
        },
      ],
      evidence,
      ambiguous: false,
    });
  }

  evidence.push({
    label: 'bank_link',
    detail: `Linked to bank transaction ${linked.bank.id} (${linked.linkReason})`,
  });

  const varianceCents = linked.bank.amountCents - expectation.expectedNetCents;

  evidence.push({
    label: 'comparison',
    detail:
      `Actual bank amount ${formatMoney(linked.bank.amountCents)} vs expected ${formatMoney(expectation.expectedNetCents)}` +
      `; variance ${formatMoney(varianceCents)}`,
  });

  const { outcome, causes } = classifyVariance(varianceCents, lines, expectation.expectedNetCents, config, evidence);

  return assembleItem({
    settlement,
    lines,
    expectation,
    outcome,
    actualAmountCents: linked.bank.amountCents,
    relatedBank: linked.bank,
    causes,
    evidence,
    ambiguous: linked.ambiguous,
  });
}

function findLinkedBankTransaction(
  settlement: SettlementHeaderInput,
  expectedNetCents: number,
  bankTransactions: BankTransactionRecord[],
  config: SettlementReconciliationConfig,
): LinkedBankTransaction | null {
  const scored = bankTransactions
    .map((bank) => ({
      bank,
      score: scoreLink(settlement, expectedNetCents, bank, config),
      reason: describeLink(settlement, bank),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0];

  if (!best) {
    return null;
  }

  const tiedCount = scored.filter((entry) => entry.score === best.score).length;

  return {
    bank: best.bank,
    linkReason: best.reason,
    ambiguous: tiedCount > 1,
  };
}

function scoreLink(
  settlement: SettlementHeaderInput,
  expectedNetCents: number,
  bank: BankTransactionRecord,
  config: SettlementReconciliationConfig,
): number {
  if (!currenciesCompatible(settlement.currency, bank.currency)) {
    return 0;
  }

  const referenceLinked = referencesLink(settlement.settlementReference, bank.externalReference);
  const daysApart = dayDistance(settlement.settlementDate, bank.postedAt);
  const dateWithinWindow = daysApart <= config.dateWindowDays;
  const vendorCompatible = vendorsCompatible(settlement.provider, bank.normalizedVendor);

  const percentLimit = (Math.abs(expectedNetCents) * config.amountLinkTolerancePercentBps) / 10_000;
  const amountNear =
    Math.abs(bank.amountCents - expectedNetCents) <=
    Math.max(config.varianceAbsoluteToleranceCents, percentLimit);

  const gated =
    referenceLinked ||
    (amountNear && dateWithinWindow) ||
    (vendorCompatible && dateWithinWindow);

  if (!gated) {
    return 0;
  }

  let score = 0;

  if (referenceLinked) {
    score += REFERENCE_LINK_SCORE;
  }

  if (amountNear) {
    score += AMOUNT_LINK_SCORE;
  }

  if (dateWithinWindow) {
    score += DATE_LINK_SCORE;
  }

  if (vendorCompatible) {
    score += VENDOR_LINK_SCORE;
  }

  return score;
}

function describeLink(settlement: SettlementHeaderInput, bank: BankTransactionRecord): string {
  if (referencesLink(settlement.settlementReference, bank.externalReference)) {
    return 'payout reference match';
  }

  const daysApart = dayDistance(settlement.settlementDate, bank.postedAt);

  return `provider/date proximity (${daysApart} day(s) apart, amounts compared by tolerance)`;
}

function currenciesCompatible(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function referencesLink(settlementReference: string | null, bankReference: string | null): boolean {
  if (!settlementReference?.trim() || !bankReference?.trim()) {
    return false;
  }

  const left = normalizeReference(settlementReference);
  const right = normalizeReference(bankReference);

  return (
    left.length > 0 &&
    right.length > 0 &&
    (left === right || left.includes(right) || right.includes(left))
  );
}

function vendorsCompatible(provider: string, bankVendor: string): boolean {
  const left = normalizeVendorName(provider ?? '');
  const right = normalizeVendorName(bankVendor ?? '');

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const leftTokens = left.split(' ').filter(Boolean);
  const rightTokens = right.split(' ').filter(Boolean);

  if (leftTokens.length <= rightTokens.length) {
    if (leftTokens.every((token) => rightTokens.includes(token))) {
      return true;
    }
  } else if (rightTokens.every((token) => leftTokens.includes(token))) {
    return true;
  }

  return similarityRatio(left, right) >= VENDOR_FUZZY_THRESHOLD;
}

function dayDistance(left: Date, right: Date): number {
  return Math.round(Math.abs(left.getTime() - right.getTime()) / 86_400_000);
}

function classifyVariance(
  varianceCents: number,
  lines: SettlementLineInput[],
  expectedNetCents: number,
  config: SettlementReconciliationConfig,
  evidence: SettlementEvidenceEntry[],
): { outcome: SettlementOutcomeType; causes: SupportedCause[] } {
  if (Math.abs(varianceCents) <= config.varianceAbsoluteToleranceCents) {
    return {
      outcome: 'exact_settlement_match',
      causes: [
        {
          causeType: 'line_alignment',
          description: 'Bank deposit equals the expected net of the settlement lines',
        },
      ],
    };
  }

  const namedLine = lines.find(
    (line) =>
      line.amountCents !== 0 &&
      Math.abs(line.amountCents - varianceCents) <= config.attributionToleranceCents &&
      (line.type === 'fee' || line.type === 'deduction' || line.type === 'refund'),
  );

  if (namedLine) {
    evidence.push({
      label: 'variance_attribution',
      detail:
        `Variance ${formatMoney(varianceCents)} matches ${namedLine.type} line ${namedLine.id}` +
        ` (${formatMoney(namedLine.amountCents)} "${namedLine.description}")`,
    });

    return {
      outcome: outcomeForNamedLine(namedLine.type),
      causes: [
        {
          causeType: causeTypeForNamedLine(namedLine.type),
          description: `${capitalize(namedLine.type)} line "${namedLine.description}" accounts for the variance`,
          settlementLineId: namedLine.id,
          amountCents: namedLine.amountCents,
        },
      ],
    };
  }

  const alignedLine = lines.find(
    (line) =>
      line.amountCents !== 0 &&
      Math.abs(line.amountCents - varianceCents) <= config.attributionToleranceCents,
  );

  const alignmentCause: SupportedCause[] = alignedLine
    ? [
        {
          causeType: 'line_alignment',
          description: `Variance amount aligns with ${alignedLine.type} line "${alignedLine.description}" (${formatMoney(alignedLine.amountCents)})`,
          settlementLineId: alignedLine.id,
          amountCents: alignedLine.amountCents,
        },
      ]
    : [];

  if (!alignedLine) {
    evidence.push({
      label: 'variance_attribution',
      detail: `No settlement line matches the variance of ${formatMoney(varianceCents)}`,
    });
  }

  const materialityLimit = (Math.abs(expectedNetCents) * config.materialityPercentBps) / 10_000;

  if (Math.abs(varianceCents) <= materialityLimit) {
    return {
      outcome: varianceCents < 0 ? 'short_pay' : 'excess_payment',
      causes: [
        ...alignmentCause,
        {
          causeType: 'directional_gap',
          description:
            varianceCents < 0
              ? 'The bank deposit is lower than the expected net with no named supporting settlement line'
              : 'The bank deposit is higher than the expected net with no named supporting settlement line',
        },
      ],
    };
  }

  return {
    outcome: 'unexplained_variance',
    causes: [
      ...alignmentCause,
      {
        causeType: 'no_supported_cause',
        description: 'The variance exceeds the materiality limit and no settlement line explains it',
      },
    ],
  };
}

function outcomeForNamedLine(type: SettlementLineInput['type']): SettlementOutcomeType {
  switch (type) {
    case 'fee':
      return 'fee_variance';
    case 'deduction':
      return 'deduction';
    case 'refund':
      return 'refund';
    default:
      return 'unexplained_variance';
  }
}

function causeTypeForNamedLine(type: SettlementLineInput['type']): SettlementCauseType {
  switch (type) {
    case 'fee':
      return 'fee_line';
    case 'deduction':
      return 'deduction_line';
    case 'refund':
      return 'refund_line';
    default:
      return 'line_alignment';
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function assembleItem(args: {
  settlement: SettlementHeaderInput;
  lines: SettlementLineInput[];
  expectation: SettlementExpectation;
  outcome: SettlementOutcomeType;
  actualAmountCents: number | null;
  relatedBank: BankTransactionRecord | null;
  causes: SupportedCause[];
  evidence: SettlementEvidenceEntry[];
  ambiguous: boolean;
}): SettlementReconciliationItem {
  const {
    settlement,
    lines,
    expectation,
    outcome,
    actualAmountCents,
    relatedBank,
    causes,
    evidence,
    ambiguous,
  } = args;
  const varianceCents =
    actualAmountCents === null ? null : actualAmountCents - expectation.expectedNetCents;

  return {
    settlementId: settlement.id,
    settlementReference: settlement.settlementReference,
    provider: settlement.provider,
    currency: settlement.currency,
    outcome,
    ambiguous,
    expectedAmountCents: expectation.expectedNetCents,
    actualAmountCents,
    varianceCents,
    expectation,
    settlementLines: lines,
    relatedBankTransactionId: relatedBank ? relatedBank.id : null,
    possibleCauses: causes,
    evidence,
    explanation: buildExplanation(
      outcome,
      expectation.expectedNetCents,
      actualAmountCents,
      varianceCents,
      causes[0],
    ),
    exceptionRaised: outcome !== 'exact_settlement_match',
  };
}

function buildExplanation(
  outcome: SettlementOutcomeType,
  expectedCents: number,
  actualCents: number | null,
  varianceCents: number | null,
  primaryCause: SupportedCause | undefined,
): string {
  switch (outcome) {
    case 'exact_settlement_match':
      return (
        `Expected settlement amount was ${formatMoney(expectedCents)}. ` +
        `Bank deposit was ${actualCents === null ? 'not found' : formatMoney(actualCents)}. No variance detected.`
      );
    case 'deduction':
      return (
        `Expected settlement amount was ${formatMoney(expectedCents)}. ` +
        `Bank deposit was ${actualCents === null ? 'not found' : formatMoney(actualCents)}. ` +
        `A ${formatMoney(Math.abs(varianceCents as number))} deduction accounts for the difference.`
      );
    case 'fee_variance':
      return (
        `Expected settlement amount was ${formatMoney(expectedCents)}. ` +
        `Bank deposit was ${actualCents === null ? 'not found' : formatMoney(actualCents)}. ` +
        `A ${formatMoney(Math.abs(varianceCents as number))} fee difference accounts for the difference.`
      );
    case 'refund':
      return (
        `Expected settlement amount was ${formatMoney(expectedCents)}. ` +
        `Bank deposit was ${actualCents === null ? 'not found' : formatMoney(actualCents)}. ` +
        `A ${formatMoney(Math.abs(varianceCents as number))} refund accounts for the difference.`
      );
    case 'short_pay':
      return (
        `Expected settlement amount was ${formatMoney(expectedCents)}. ` +
        `Bank deposit was ${actualCents === null ? 'not found' : formatMoney(actualCents)}. ` +
        `The deposit is short by ${formatMoney(Math.abs(varianceCents as number))}; no settlement line explains the difference.`
      );
    case 'excess_payment':
      return (
        `Expected settlement amount was ${formatMoney(expectedCents)}. ` +
        `Bank deposit was ${actualCents === null ? 'not found' : formatMoney(actualCents)}. ` +
        `The deposit exceeds expectations by ${formatMoney(Math.abs(varianceCents as number))}; ` +
        `no settlement line explains the difference.`
      );
    case 'unexplained_variance':
      return (
        `Expected settlement amount was ${formatMoney(expectedCents)}. ` +
        `Bank deposit was ${actualCents === null ? 'not found' : formatMoney(actualCents)}. ` +
        `The variance of ${varianceCents === null ? 'unknown size' : formatMoney(varianceCents)} ` +
        `is unexplained by the settlement records.` +
        (primaryCause ? ` Review required: ${primaryCause.description}.` : '')
      );
    case 'missing_settlement':
      return `No bank transaction was found for this settlement. Expected deposit was ${formatMoney(expectedCents)}.`;
  }
}

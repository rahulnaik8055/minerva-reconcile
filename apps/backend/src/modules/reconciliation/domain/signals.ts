import { normalizeReference, normalizeVendorName } from '../../imports/lib/normalize';
import type { MatchConfig } from './config';
import { similarityRatio } from './similarity';
import type {
  AmountTier,
  DateTier,
  ReferenceTier,
  SignalAssessment,
  VendorTier,
} from './types';

export function formatCents(amountCents: number): string {
  const sign = amountCents < 0 ? '-' : '';
  const absolute = Math.abs(amountCents);
  const cents = absolute % 100;
  const units = (absolute - cents) / 100;

  return `${sign}${units}.${String(cents).padStart(2, '0')}`;
}

export interface AmountCandidateValue {
  amountCents: number;
  label: string;
}

export function scoreAmount(
  bankAmountCents: number,
  candidate: AmountCandidateValue,
  config: MatchConfig,
): SignalAssessment {
  const difference = Math.abs(bankAmountCents - candidate.amountCents);

  if (difference === 0) {
    return assessment('amount', 1, 'exact', true, true, `Exact amount ${formatCents(bankAmountCents)}`);
  }

  if (
    bankAmountCents !== 0 &&
    candidate.amountCents !== 0 &&
    bankAmountCents + candidate.amountCents === 0
  ) {
    return assessment(
      'amount',
      1,
      'offsetting_exact',
      true,
      true,
      `Exact offsetting amounts: bank ${formatCents(bankAmountCents)} vs ${candidate.label} ${formatCents(candidate.amountCents)}`,
    );
  }

  const percentToleranceCents =
    (Math.abs(bankAmountCents) * config.amountTolerance.percentBps) / 10_000;
  const toleranceLimit = Math.max(config.amountTolerance.absoluteCents, percentToleranceCents);

  if (difference <= toleranceLimit) {
    return assessment(
      'amount',
      0.85,
      'within_tolerance',
      true,
      true,
      `Amounts differ by ${formatCents(difference)} which is within the configured tolerance`,
    );
  }

  return assessment(
    'amount',
    0,
    'mismatch',
    true,
    false,
    `Amount mismatch: bank ${formatCents(bankAmountCents)} vs ${candidate.label} ${formatCents(candidate.amountCents)} (${formatCents(difference)} apart)`,
  );
}

export function scoreReference(
  bankReference: string | null,
  candidateReference: string | null | undefined,
): SignalAssessment {
  if (!bankReference?.trim() || !candidateReference?.trim()) {
    return assessment(
      'reference',
      0,
      'absent',
      false,
      false,
      'Reference unavailable on one side; signal ignored and weight redistributed',
    );
  }

  const left = normalizeReference(bankReference);
  const right = normalizeReference(candidateReference);

  if (left === right) {
    return assessment(
      'reference',
      1,
      'exact',
      true,
      true,
      `Reference ${left} found in both records`,
    );
  }

  if (left.includes(right) || right.includes(left)) {
    return assessment(
      'reference',
      0.5,
      'partial',
      true,
      true,
      `Partial reference overlap: ${left} vs ${candidateReference}`,
    );
  }

  return assessment(
    'reference',
    0,
    'mismatch',
    true,
    false,
    `References do not correspond: ${bankReference} vs ${candidateReference}`,
  );
}

export function scoreVendor(
  bankVendor: string,
  candidateVendor: string | null | undefined,
  config: MatchConfig,
): SignalAssessment {
  const left = normalizeVendorName(bankVendor ?? '');

  if (!left || !candidateVendor?.trim()) {
    return assessment(
      'vendor',
      0,
      'absent',
      false,
      false,
      'Vendor unavailable on one side; signal ignored and weight redistributed',
    );
  }

  const right = normalizeVendorName(candidateVendor);

  if (left === right && left.length > 0) {
    return assessment(
      'vendor',
      1,
      'normalized_exact',
      true,
      true,
      `${right} matched after normalization`,
    );
  }

  const leftTokens = left.split(' ').filter(Boolean);
  const rightTokens = right.split(' ').filter(Boolean);
  const shorterTokens = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longerTokens = shorterTokens === leftTokens ? rightTokens : leftTokens;
  const contained =
    shorterTokens.length > 0 && shorterTokens.every((token) => longerTokens.includes(token));

  if (contained) {
    return assessment(
      'vendor',
      config.vendorTokenSubsetScore,
      'token_subset',
      true,
      true,
      `${shorterTokens.join(' ')} tokens fully contained in ${longerTokens.join(' ')}`,
    );
  }

  const ratio = similarityRatio(left, right);

  if (ratio >= config.vendorFuzzyThreshold) {
    return assessment(
      'vendor',
      ratio,
      'fuzzy',
      true,
      true,
      `Fuzzy similarity ${ratio.toFixed(2)} between ${left} and ${right}`,
    );
  }

  return assessment(
    'vendor',
    0,
    'mismatch',
    true,
    false,
    `Counterparty mismatch: ${left} vs ${right}`,
  );
}

export function scoreDate(
  bankDate: Date,
  candidateDate: Date,
  config: MatchConfig,
): SignalAssessment {
  const dayMs = 86_400_000;
  const daysApart = Math.round(Math.abs(bankDate.getTime() - candidateDate.getTime()) / dayMs);
  const detailFor = (tier: string): string =>
    tier === 'same_day' ? 'Same calendar day' : `${daysApart} days apart`;

  let tier: DateTier;

  if (daysApart === 0) {
    tier = 'same_day';
  } else if (daysApart <= config.dateWindows.nearDays) {
    tier = 'within_2_days';
  } else if (daysApart <= config.dateWindows.extendedDays) {
    tier = 'within_5_days';
  } else {
    tier = 'outside_window';
  }

  const scoreByTier: Record<DateTier, number> = {
    same_day: config.dateScores.sameDay,
    within_2_days: config.dateScores.near,
    within_5_days: config.dateScores.extended,
    outside_window: config.dateScores.outside,
  };

  const matched = tier !== 'outside_window';

  return assessment(
    'date',
    scoreByTier[tier],
    tier,
    true,
    matched,
    matched ? detailFor(tier) : `${daysApart} days apart, outside the matching window`,
  );
}

function assessment(
  name: SignalAssessment['name'],
  score: number,
  tier: AmountTier | ReferenceTier | VendorTier | DateTier,
  applicable: boolean,
  matched: boolean,
  detail: string,
): SignalAssessment {
  return { name, score, tier, applicable, matched, detail };
}

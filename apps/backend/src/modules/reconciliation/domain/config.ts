import type { MatchClassification } from './types';

export interface MatchWeights {
  amount: number;
  reference: number;
  vendor: number;
  date: number;
}

export interface AmountToleranceConfig {
  absoluteCents: number;
  percentBps: number;
}

export interface DateWindowConfig {
  nearDays: number;
  extendedDays: number;
}

export interface DateScoreConfig {
  sameDay: number;
  near: number;
  extended: number;
  outside: number;
}

export interface ClassificationThresholds {
  strongMin: number;
  reviewMin: number;
}

export interface MatchConfig {
  weights: MatchWeights;
  amountTolerance: AmountToleranceConfig;
  dateWindows: DateWindowConfig;
  dateScores: DateScoreConfig;
  referencePartialScore: number;
  vendorFuzzyThreshold: number;
  vendorTokenSubsetScore: number;
  ambiguityEpsilon: number;
  classification: ClassificationThresholds;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  weights: {
    amount: 0.4,
    reference: 0.25,
    vendor: 0.2,
    date: 0.15,
  },
  amountTolerance: {
    absoluteCents: 100,
    percentBps: 50,
  },
  dateWindows: {
    nearDays: 2,
    extendedDays: 5,
  },
  dateScores: {
    sameDay: 1,
    near: 0.9,
    extended: 0.8,
    outside: 0,
  },
  referencePartialScore: 0.5,
  vendorFuzzyThreshold: 0.82,
  vendorTokenSubsetScore: 0.85,
  ambiguityEpsilon: 0.02,
  classification: {
    strongMin: 0.9,
    reviewMin: 0.6,
  },
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export function resolveMatchConfig(overrides?: DeepPartial<MatchConfig>): MatchConfig {
  if (!overrides) {
    return { ...DEFAULT_MATCH_CONFIG };
  }

  return {
    weights: { ...DEFAULT_MATCH_CONFIG.weights, ...overrides.weights },
    amountTolerance: { ...DEFAULT_MATCH_CONFIG.amountTolerance, ...overrides.amountTolerance },
    dateWindows: { ...DEFAULT_MATCH_CONFIG.dateWindows, ...overrides.dateWindows },
    dateScores: { ...DEFAULT_MATCH_CONFIG.dateScores, ...overrides.dateScores },
    referencePartialScore:
      overrides.referencePartialScore ?? DEFAULT_MATCH_CONFIG.referencePartialScore,
    vendorFuzzyThreshold:
      overrides.vendorFuzzyThreshold ?? DEFAULT_MATCH_CONFIG.vendorFuzzyThreshold,
    vendorTokenSubsetScore:
      overrides.vendorTokenSubsetScore ?? DEFAULT_MATCH_CONFIG.vendorTokenSubsetScore,
    ambiguityEpsilon: overrides.ambiguityEpsilon ?? DEFAULT_MATCH_CONFIG.ambiguityEpsilon,
    classification: { ...DEFAULT_MATCH_CONFIG.classification, ...overrides.classification },
  };
}

export function classifyScore(score: number, config: MatchConfig): MatchClassification {
  if (score >= config.classification.strongMin) {
    return 'strong_match';
  }

  if (score >= config.classification.reviewMin) {
    return 'needs_review';
  }

  return 'weak_unmatched';
}

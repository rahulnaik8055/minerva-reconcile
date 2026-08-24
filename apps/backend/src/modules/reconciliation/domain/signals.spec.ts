import { resolveMatchConfig } from './config';
import { formatCents, scoreAmount, scoreDate, scoreReference, scoreVendor } from './signals';
import { levenshteinDistance, similarityRatio } from './similarity';

describe('similarity helpers', () => {
  it('computes levenshtein distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });

  it('converts distance into a 0..1 ratio', () => {
    expect(similarityRatio('abcd', 'abcd')).toBe(1);
    expect(similarityRatio('globex medla', 'globex media')).toBeCloseTo(1 - 1 / 12, 5);
    expect(similarityRatio('abc', 'xyz')).toBe(0);
    expect(similarityRatio('', '')).toBe(1);
  });
});

describe('formatCents', () => {
  it('renders integer cents as signed decimal strings', () => {
    expect(formatCents(-25000)).toBe('-250.00');
    expect(formatCents(99)).toBe('0.99');
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(109000)).toBe('1090.00');
  });
});

describe('scoreAmount', () => {
  const config = resolveMatchConfig();

  it('scores identical amounts as exact', () => {
    const result = scoreAmount(-25000, { amountCents: -25000, label: 'ledger entry' }, config);

    expect(result.score).toBe(1);
    expect(result.tier).toBe('exact');
    expect(result.matched).toBe(true);
  });

  it('recognizes offsetting signs as an exact economic match', () => {
    const result = scoreAmount(-25000, { amountCents: 25000, label: 'invoice' }, config);

    expect(result.score).toBe(1);
    expect(result.tier).toBe('offsetting_exact');
    expect(result.detail).toContain('offsetting');
  });

  it('accepts differences inside the absolute tolerance', () => {
    const result = scoreAmount(-25000, { amountCents: -24920, label: 'invoice' }, config);

    expect(result.tier).toBe('within_tolerance');
    expect(result.score).toBe(0.85);
    expect(result.detail).toContain('tolerance');
  });

  it('accepts proportional differences for large amounts via percentBps', () => {
    const result = scoreAmount(10_000_000, { amountCents: 9_980_000, label: 'settlement net' }, config);

    expect(result.tier).toBe('within_tolerance');
  });

  it('rejects differences beyond tolerance', () => {
    const result = scoreAmount(-50000, { amountCents: -10000, label: 'invoice' }, config);

    expect(result.score).toBe(0);
    expect(result.tier).toBe('mismatch');
    expect(result.matched).toBe(false);
  });

  it('honors custom tolerances from configuration overrides', () => {
    const strict = resolveMatchConfig({ amountTolerance: { absoluteCents: 0, percentBps: 0 } });
    const result = scoreAmount(-25000, { amountCents: -24999, label: 'invoice' }, strict);

    expect(result.tier).toBe('mismatch');
  });
});

describe('scoreReference', () => {
  it('matches references after normalization', () => {
    const result = scoreReference('inv-1007', 'INV 1007');

    expect(result.score).toBe(1);
    expect(result.tier).toBe('exact');
    expect(result.detail).toContain('INV1007');
  });

  it('scores containment as partial in both directions', () => {
    const bankLonger = scoreReference('INV1007X', 'INV1007');
    const candidateLonger = scoreReference('INV10', 'INV1007');

    expect(bankLonger.score).toBe(0.5);
    expect(bankLonger.tier).toBe('partial');
    expect(candidateLonger.tier).toBe('partial');
    expect(candidateLonger.score).toBe(0.5);
  });

  it('treats a missing reference on either side as not applicable', () => {
    const noBank = scoreReference(null, 'INV1007');
    const noCandidate = scoreReference('INV1007', '');

    expect(noBank.applicable).toBe(false);
    expect(noBank.tier).toBe('absent');
    expect(noCandidate.applicable).toBe(false);
  });

  it('scores conflicting references as mismatch', () => {
    const result = scoreReference('INV1111', 'INV9999');

    expect(result.applicable).toBe(true);
    expect(result.matched).toBe(false);
    expect(result.tier).toBe('mismatch');
    expect(result.score).toBe(0);
  });
});

describe('scoreVendor', () => {
  const config = resolveMatchConfig();

  it('matches vendors that normalize to the same value', () => {
    const result = scoreVendor('Acme Office Supply Co Ltd', 'ACME OFFICE SUPPLY INC', config);

    expect(result.score).toBe(1);
    expect(result.tier).toBe('normalized_exact');
    expect(result.detail).toContain('ACME OFFICE SUPPLY');
  });

  it('scores token subset relationships below exact but above mismatch', () => {
    const result = scoreVendor('AMAZON MARKETPLACE', 'Amazon', config);

    expect(result.tier).toBe('token_subset');
    expect(result.score).toBe(config.vendorTokenSubsetScore);
    expect(result.matched).toBe(true);
  });

  it('uses fuzzy similarity for close but unequal names', () => {
    const result = scoreVendor('GLOBEX MEDIA', 'GLOBEX MEDLA', config);

    expect(result.tier).toBe('fuzzy');
    expect(result.score).toBeGreaterThanOrEqual(config.vendorFuzzyThreshold);
    expect(result.detail).toMatch(/Fuzzy similarity/);
  });

  it('rejects unrelated counterparties', () => {
    const result = scoreVendor('INITECH CONSULTING', 'SOYLENT', config);

    expect(result.score).toBe(0);
    expect(result.tier).toBe('mismatch');
  });

  it('ignores the signal when the candidate has no vendor', () => {
    const result = scoreVendor('ACME', '', config);

    expect(result.applicable).toBe(false);
    expect(result.tier).toBe('absent');
  });
});

describe('scoreDate', () => {
  const config = resolveMatchConfig();
  const base = new Date(Date.UTC(2026, 6, 3));

  const daysFromBase = (days: number): Date => new Date(base.getTime() + days * 86_400_000);

  it.each([
    [0, 'same_day', 1],
    [2, 'within_2_days', 0.9],
    [3, 'within_5_days', 0.8],
    [5, 'within_5_days', 0.8],
    [6, 'outside_window', 0],
  ])('scores a %i day gap as %s with %p', (days, tier, expectedScore) => {
    const result = scoreDate(base, daysFromBase(days), config);

    expect(result.tier).toBe(tier);
    expect(result.score).toBe(expectedScore);
  });

  it('describes the gap in plain language', () => {
    expect(scoreDate(base, daysFromBase(0), config).detail).toBe('Same calendar day');
    expect(scoreDate(base, daysFromBase(3), config).detail).toBe('3 days apart');
    expect(scoreDate(base, daysFromBase(30), config).detail).toContain('outside the matching window');
  });

  it('honors configured window sizes and scores', () => {
    const custom = resolveMatchConfig({
      dateWindows: { nearDays: 4, extendedDays: 8 },
      dateScores: { sameDay: 1, near: 1, extended: 0.5, outside: 0 },
    });

    const fourDays = scoreDate(base, daysFromBase(4), custom);
    const sixDays = scoreDate(base, daysFromBase(6), custom);

    expect(fourDays.tier).toBe('within_2_days');
    expect(fourDays.score).toBe(1);
    expect(sixDays.tier).toBe('within_5_days');
    expect(sixDays.score).toBe(0.5);
  });
});

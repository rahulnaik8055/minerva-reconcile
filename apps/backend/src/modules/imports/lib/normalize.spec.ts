import {
  collapseWhitespace,
  normalizeAmountToCents,
  normalizeCurrency,
  normalizeDate,
  normalizeReference,
  normalizeText,
  normalizeVendorName,
} from './normalize';

describe('normalizeDate', () => {
  it('parses ISO dates', () => {
    expect(normalizeDate('2026-07-03')).toEqual(new Date(Date.UTC(2026, 6, 3)));
    expect(normalizeDate('2026-7-3')).toEqual(new Date(Date.UTC(2026, 6, 3)));
    expect(normalizeDate('2026/07/03')).toEqual(new Date(Date.UTC(2026, 6, 3)));
  });

  it('parses US slash dates as month/day/year', () => {
    expect(normalizeDate('07/06/2026')).toEqual(new Date(Date.UTC(2026, 6, 6)));
  });

  it('parses European dot dates as day.month.year', () => {
    expect(normalizeDate('14.07.2026')).toEqual(new Date(Date.UTC(2026, 6, 14)));
  });

  it('parses month name dates', () => {
    expect(normalizeDate('July 9 2026')).toEqual(new Date(Date.UTC(2026, 6, 9)));
    expect(normalizeDate('Aug 9, 2026')).toEqual(new Date(Date.UTC(2026, 7, 9)));
    expect(normalizeDate('9 March 2026')).toEqual(new Date(Date.UTC(2026, 2, 9)));
  });

  it('rejects invalid dates', () => {
    expect(normalizeDate('')).toBeUndefined();
    expect(normalizeDate('not a date')).toBeUndefined();
    expect(normalizeDate('2026-13-01')).toBeUndefined();
    expect(normalizeDate('02/30/2026')).toBeUndefined();
  });
});

describe('normalizeAmountToCents', () => {
  it.each([
    ['-250.00', -25000],
    ['$1,180.00', 118000],
    ['(75.50)', -7550],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['12,34', 1234],
    ['480', 48000],
    ['.99', 99],
    ['+42.10', 4210],
    ['-0.005', -1],
    ['1,234,567.89', 123456789],
    ['0.00', 0],
  ])('converts %s to cents', (input, expected) => {
    expect(normalizeAmountToCents(input)).toBe(expected);
  });

  it.each(['abc', '', '12..34', '$--5'])('rejects %s', (input) => {
    expect(normalizeAmountToCents(input)).toBeUndefined();
  });
});

describe('normalizeCurrency', () => {
  it('uppercases and trims valid codes', () => {
    expect(normalizeCurrency('usd')).toBe('USD');
    expect(normalizeCurrency(' eur ')).toBe('EUR');
  });

  it('rejects invalid codes and empty input', () => {
    expect(normalizeCurrency('EURO')).toBeUndefined();
    expect(normalizeCurrency('')).toBeUndefined();
    expect(normalizeCurrency(undefined)).toBeUndefined();
  });
});

describe('normalizeVendorName', () => {
  it('collapses whitespace and uppercases', () => {
    expect(normalizeVendorName('  acme   office supply  ')).toBe('ACME OFFICE SUPPLY');
  });

  it('strips trailing legal suffixes repeatedly', () => {
    expect(normalizeVendorName('Initech Consulting Group LLC')).toBe('INITECH CONSULTING');
    expect(normalizeVendorName('Soylent Corp.')).toBe('SOYLENT');
    expect(normalizeVendorName('Acme Office Supply Co Ltd')).toBe('ACME OFFICE SUPPLY');
  });

  it('expands ampersands and strips surrounding punctuation', () => {
    expect(normalizeVendorName('"Johnson & Johnson"')).toBe('JOHNSON AND JOHNSON');
  });

  it('keeps ordinary names intact', () => {
    expect(normalizeVendorName('Stripe')).toBe('STRIPE');
    expect(normalizeVendorName('Globex Media')).toBe('GLOBEX MEDIA');
  });
});

describe('reference and text helpers', () => {
  it('normalizes references to uppercase alphanumerics', () => {
    expect(normalizeReference('inv-1007')).toBe('INV1007');
    expect(normalizeReference('INV 1007')).toBe('INV1007');
    expect(normalizeReference('payout_8891/a')).toBe('PAYOUT8891A');
  });

  it('collapses whitespace in text fields', () => {
    expect(normalizeText('  multiple   spaces \t here ')).toBe('multiple spaces here');
  });

  it('collapses whitespace helper', () => {
    expect(collapseWhitespace('\ta\nb  c ')).toBe('a b c');
  });
});

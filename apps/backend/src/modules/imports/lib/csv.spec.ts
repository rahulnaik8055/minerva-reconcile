import {
  assertRequiredColumns,
  extractRowValues,
  HeaderValidationError,
  resolveHeaders,
} from './column-mapper';
import { BANK_COLUMN_ALIASES, BANK_REQUIRED_COLUMNS } from './column-specs';
import { parseCsv } from './parse-csv';

describe('parseCsv', () => {
  it('parses headers and data rows with 1-based row numbers excluding the header', () => {
    const result = parseCsv('Date,Amount\n2026-07-03,-250.00\n2026-07-04,-49.99');

    expect(result.headers).toEqual(['Date', 'Amount']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.rowNumber).toBe(2);
    expect(result.rows[1]?.values['Amount']).toBe('-49.99');
    expect(result.syntaxErrors).toEqual([]);
  });

  it('preserves values containing commas through quoting', () => {
    const result = parseCsv('Vendor,Amount\n"Acme Office Supply, Co.",-49.99');

    expect(result.rows[0]?.values['Vendor']).toBe('Acme Office Supply, Co.');
    expect(result.rows[0]?.values['Amount']).toBe('-49.99');
  });

  it('strips a UTF-8 byte order mark', () => {
    const result = parseCsv('\uFEFFDate,Amount\n2026-07-03,-250.00');

    expect(result.headers).toEqual(['Date', 'Amount']);
  });

  it('skips empty lines', () => {
    const result = parseCsv('Date,Amount\n2026-07-03,-250.00\n\n\n2026-07-04,-49.99');

    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]?.rowNumber).toBe(3);
  });

  it('reports malformed quoting as syntax errors instead of throwing', () => {
    const result = parseCsv('Date,Amount\n2026-07-03,"-250.00');

    expect(result.syntaxErrors.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.rows)).toBe(true);
  });
});

describe('resolveHeaders', () => {
  it('maps aliased headers to canonical names regardless of case and punctuation', () => {
    const { columnByCanonical, missingCanonicals } = resolveHeaders(
      ['Transaction Date', 'AMOUNT', 'currency_code', 'Memo'],
      BANK_COLUMN_ALIASES,
    );

    expect(columnByCanonical['postedAt']).toBe('Transaction Date');
    expect(columnByCanonical['amount']).toBe('AMOUNT');
    expect(columnByCanonical['currency']).toBe('currency_code');
    expect(columnByCanonical['description']).toBe('Memo');
    expect(missingCanonicals).toEqual(['externalReference', 'vendor']);
  });

  it('keeps the first matching column when two map to the same canonical name', () => {
    const { columnByCanonical } = resolveHeaders(
      ['Date', 'Posted Date', 'Amount'],
      { postedAt: ['date', 'posted date'], amount: ['amount'] },
    );

    expect(columnByCanonical['postedAt']).toBe('Date');
  });
});

describe('extractRowValues', () => {
  it('collects trimmed canonical values and defaults missing columns to empty strings', () => {
    const values = extractRowValues(
      { 'Posted Date': ' 2026-07-03 ', Amount: '-250.00' },
      { postedAt: 'Posted Date', amount: 'Amount', description: 'Memo' },
    );

    expect(values).toEqual({
      postedAt: '2026-07-03',
      amount: '-250.00',
      description: '',
    });
  });
});

describe('HeaderValidationError', () => {
  it('lists the missing and found columns in its message', () => {
    try {
      assertBankHeaders(['Vendor Only']);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HeaderValidationError);
      const headerError = error as HeaderValidationError;

      expect(headerError.message).toContain('Missing required column(s): postedAt, amount, description');
      expect(headerError.message).toContain('Found columns: Vendor Only');
    }
  });

  function assertBankHeaders(headers: string[]): void {
    assertRequiredColumns(headers, BANK_COLUMN_ALIASES, BANK_REQUIRED_COLUMNS);
  }
});

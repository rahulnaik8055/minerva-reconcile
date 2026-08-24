import Papa from 'papaparse';

export interface CsvRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface CsvSyntaxError {
  rowNumber?: number;
  message: string;
}

export interface ParseResult {
  headers: string[];
  rows: CsvRow[];
  syntaxErrors: CsvSyntaxError[];
}

export function parseCsv(content: string): ParseResult {
  const result = Papa.parse<Record<string, unknown>>(content.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  const headers = (result.meta.fields ?? []).filter((field): field is string => !!field);
  const rows = result.data.map((values, index) => ({
    rowNumber: index + 2,
    values: stringifyValues(values),
  }));
  const syntaxErrors = result.errors.map((error) => ({
    rowNumber: typeof error.row === 'number' ? error.row + 2 : undefined,
    message: `${error.code}: ${error.message}`,
  }));

  return { headers, rows, syntaxErrors };
}

function stringifyValues(row: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    values[key] = value === null || value === undefined ? '' : String(value);
  }

  return values;
}

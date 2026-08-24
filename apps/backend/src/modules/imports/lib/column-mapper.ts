export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface HeaderResolution {
  columnByCanonical: Record<string, string>;
  missingCanonicals: string[];
}

export function resolveHeaders(
  headers: string[],
  aliases: Record<string, readonly string[]>,
): HeaderResolution {
  const canonicalByHeader = new Map<string, string>();

  for (const [canonical, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      const normalized = normalizeHeader(alias);

      if (!canonicalByHeader.has(normalized)) {
        canonicalByHeader.set(normalized, canonical);
      }
    }
  }

  const columnByCanonical: Record<string, string> = {};
  const resolved = new Set<string>();

  for (const header of headers) {
    const canonical = canonicalByHeader.get(normalizeHeader(header));

    if (canonical && !resolved.has(canonical)) {
      columnByCanonical[canonical] = header;
      resolved.add(canonical);
    }
  }

  const missingCanonicals = Object.keys(aliases).filter((canonical) => !resolved.has(canonical));

  return { columnByCanonical, missingCanonicals };
}

export interface MissingColumnError {
  missing: string[];
  found: string[];
}

export class HeaderValidationError extends Error {
  readonly missing: string[];
  readonly found: string[];

  constructor(error: MissingColumnError) {
    super(
      `Missing required column(s): ${error.missing.join(', ')}. Found columns: ${
        error.found.length > 0 ? error.found.join(', ') : '(none)'
      }`,
    );
    this.name = 'HeaderValidationError';
    this.missing = error.missing;
    this.found = error.found;
  }
}

export function assertRequiredColumns(
  headers: string[],
  aliases: Record<string, readonly string[]>,
  required: readonly string[],
): void {
  const { columnByCanonical } = resolveHeaders(headers, aliases);
  const missingRequired = required.filter((canonical) => !columnByCanonical[canonical]);

  if (missingRequired.length > 0) {
    throw new HeaderValidationError({ missing: [...missingRequired], found: headers });
  }
}

export function extractRowValues(
  row: Record<string, string>,
  columnByCanonical: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [canonical, columnName] of Object.entries(columnByCanonical)) {
    values[canonical] = (row[columnName] ?? '').trim();
  }

  return values;
}

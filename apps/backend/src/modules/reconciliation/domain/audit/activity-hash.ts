import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) {
        sorted[key] = sortValue(source[key]);
      }
    }

    return sorted;
  }

  return value;
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function computeActivityHash(previousHash: string, payload: unknown): string {
  return sha256Hex(previousHash + canonicalizeJson(payload));
}

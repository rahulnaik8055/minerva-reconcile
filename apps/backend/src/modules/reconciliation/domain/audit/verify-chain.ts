import { GENESIS_HASH, computeActivityHash } from './activity-hash';

export interface ActivityChainEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  payloadJson: unknown;
  previousHash: string;
  hash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  checkedCount: number;
  brokenAtIndex: number | null;
  reason: string | null;
}

export function verifyActivityChain(entries: ActivityChainEntry[]): ChainVerificationResult {
  let previousHash = GENESIS_HASH;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];

    if (entry.previousHash !== previousHash) {
      let reason: string;

      if (index === 0) {
        reason = 'First entry must chain from the genesis hash; earlier activity may have been removed';
      } else if (entry.previousHash === GENESIS_HASH) {
        reason = 'Entry claims to be the first entry but earlier entries exist in the chain';
      } else {
        reason = `Stored previousHash does not match the hash of the preceding entry at position ${index}`;
      }

      return {
        valid: false,
        checkedCount: entries.length,
        brokenAtIndex: index,
        reason,
      };
    }

    const expected = computeActivityHash(entry.previousHash, entry.payloadJson);

    if (entry.hash !== expected) {
      return {
        valid: false,
        checkedCount: entries.length,
        brokenAtIndex: index,
        reason: `Recomputed hash does not match the stored hash at position ${index}; the payload was altered after being written`,
      };
    }

    previousHash = entry.hash;
  }

  return { valid: true, checkedCount: entries.length, brokenAtIndex: null, reason: null };
}

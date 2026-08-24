import { canonicalizeJson, computeActivityHash, GENESIS_HASH } from './activity-hash';
import { verifyActivityChain } from './verify-chain';
import type { ActivityChainEntry } from './verify-chain';

describe('activity hash', () => {
  it('is deterministic regardless of key order', () => {
    const payloadA = { actor: 'a', action: 'x', reason: 'why' };
    const payloadB = { reason: 'why', action: 'x', actor: 'a' };

    expect(canonicalizeJson(payloadA)).toBe(canonicalizeJson(payloadB));
    expect(computeActivityHash(GENESIS_HASH, payloadA)).toBe(
      computeActivityHash(GENESIS_HASH, payloadB),
    );
  });

  it('produces 64-character lowercase hex digests', () => {
    const hash = computeActivityHash(GENESIS_HASH, { value: 1 });

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the previous hash changes (chaining effect)', () => {
    const payload = { action: 'proposal.approved' };

    expect(computeActivityHash(GENESIS_HASH, payload)).not.toBe(
      computeActivityHash(computeActivityHash(GENESIS_HASH, payload), payload),
    );
  });

  it('drops undefined properties but keeps nulls', () => {
    expect(canonicalizeJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

function buildEntry(index: number, previousHash: string): ActivityChainEntry {
  const payloadJson = {
    actor: 'reviewer@example.com',
    action: 'proposal.approved',
    entityType: 'proposal',
    entityId: `00000000-0000-4000-8000-00000000000${index}`,
    previousState: { status: 'pending' },
    newState: { status: 'accepted' },
    reason: null,
    timestamp: `2026-08-24T10:00:0${index}.000Z`,
  };

  return {
    id: `00000000-0000-4000-9000-00000000000${index}`,
    actor: 'reviewer@example.com',
    action: 'proposal.approved',
    entityType: 'proposal',
    entityId: '00000000-0000-4000-8000-000000000000',
    payloadJson,
    previousHash,
    hash: computeActivityHash(previousHash, payloadJson),
  };
}

describe('verifyActivityChain', () => {
  it('accepts a valid chain starting from the genesis hash', () => {
    const first = buildEntry(1, GENESIS_HASH);
    const second = buildEntry(2, first.hash);
    const third = buildEntry(3, second.hash);

    const result = verifyActivityChain([first, second, third]);

    expect(result).toEqual({
      valid: true,
      checkedCount: 3,
      brokenAtIndex: null,
      reason: null,
    });
  });

  it('accepts an empty chain', () => {
    expect(verifyActivityChain([]).valid).toBe(true);
  });

  it('detects an altered payload in the middle of the chain', () => {
    const first = buildEntry(1, GENESIS_HASH);
    const tampered: ActivityChainEntry = {
      ...buildEntry(2, first.hash),
      payloadJson: {
        ...(buildEntry(2, first.hash).payloadJson as Record<string, unknown>),
        newState: { status: 'rejected' },
      },
    };

    const result = verifyActivityChain([first, tampered]);

    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.reason).toContain('Recomputed hash does not match');
  });

  it('detects a broken link between entries', () => {
    const first = buildEntry(1, GENESIS_HASH);
    const orphaned = buildEntry(2, GENESIS_HASH);

    const result = verifyActivityChain([first, orphaned]);

    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.reason).toContain('claims to be the first entry');
  });

  it('rejects a non-genesis entry presented as the first entry', () => {
    const later = buildEntry(2, computeActivityHash(GENESIS_HASH, { seed: true }));

    const result = verifyActivityChain([later]);

    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(0);
    expect(result.reason).toContain('genesis');
  });
});

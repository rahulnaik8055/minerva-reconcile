import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { asc, eq } from 'drizzle-orm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ReviewService } from './review.service';
import { verifyActivityChain } from '../domain/audit/verify-chain';
import type { ActivityChainEntry } from '../domain/audit/verify-chain';
import { computeActivityHash } from '../domain/audit/activity-hash';
import * as aiProvider from '../ai/ai-provider';
import * as schema from '../../../database/schema';
import {
  activityLog,
  bankTransactions,
  evidence,
  imports,
  invoices,
  ledgerEntries,
  proposalLinks,
  reconciliationProposals,
  settlementLines,
  settlements,
} from '../../../database/schema';
import type { DatabaseConnection } from '../../../interfaces/database.interface';

const ADMIN_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
const TEST_DB = 'reconcile_review_test';
const TEST_URL = `postgresql://postgres:postgres@localhost:5432/${TEST_DB}`;

const ACTOR_A = 'alice@example.com';
const ACTOR_B = 'bob@example.com';

describe('ReviewService (integration)', () => {
  let adminPool: Pool;
  let pool: Pool;
  let connection: DatabaseConnection;
  let service: ReviewService;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });

    const existsResult = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DB,
    ]);

    if (existsResult.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE ${TEST_DB}`);
    }

    pool = new Pool({ connectionString: TEST_URL });
    await applyMigrationsIfNeeded(pool);
    await resetTables(pool);

    const db = drizzle(pool, { schema });

    connection = { pool, db };
    service = new ReviewService(connection);
  }, 60000);

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }

    if (adminPool) {
      await adminPool.end();
    }
  });

  describe('approve', () => {
    it('marks the proposal accepted, records the reviewer and timestamp, and appends an activity entry', async () => {
      const proposalId = await seedPendingProposal();

      const result = await service.approveProposal(proposalId, ACTOR_A, {
        note: 'Matches the wire transfer evidence',
      });

      expect(result.proposal.status).toBe('accepted');
      expect(result.proposal.decidedBy).toBe(ACTOR_A);
      expect(result.proposal.decidedAt).not.toBeNull();
      expect(result.activity).toHaveLength(1);

      const [entry] = result.activity;
      expect(entry.action).toBe('proposal.approved');
      expect(entry.actor).toBe(ACTOR_A);
      expect(entry.entityType).toBe('proposal');
      expect(entry.entityId).toBe(proposalId);
      expect(entry.payload).toMatchObject({
        previousState: { status: 'pending' },
        newState: { status: 'accepted' },
        reason: 'Matches the wire transfer evidence',
        actor: ACTOR_A,
      });

      const persisted = await service.getProposal(proposalId);
      expect(persisted.status).toBe('accepted');

      const logged = await fetchActivityFor(proposalId);
      expect(logged.map((entry) => entry.action)).toEqual(['proposal.approved']);
    });
  });

  describe('reject', () => {
    it('marks the proposal rejected and records the reason', async () => {
      const proposalId = await seedPendingProposal();

      const result = await service.rejectProposal(proposalId, ACTOR_B, { reason: 'Wrong counterparty' });

      expect(result.proposal.status).toBe('rejected');
      expect(result.proposal.decidedBy).toBe(ACTOR_B);

      const [entry] = result.activity;
      expect(entry.action).toBe('proposal.rejected');
      expect((entry.payload as Record<string, unknown>)['reason']).toBe('Wrong counterparty');
    });
  });

  describe('override', () => {
    it('preserves the original proposal, creates a linked manual proposal, requires a reason, and appends activity', async () => {
      const originalId = await seedPendingProposal();
      const decided = await service.approveProposal(originalId, ACTOR_A, {});
      expect(decided.proposal.status).toBe('accepted');

      const result = await service.overrideProposal(originalId, ACTOR_B, {
        reason: 'Matched against the wrong deposit; correcting to manual review',
      });

      expect(result.supersededProposalId).toBe(originalId);
      expect(result.proposal.method).toBe('manual');
      expect(result.proposal.status).toBe('pending');
      expect(result.activity.map((entry) => entry.action)).toEqual([
        'proposal.overridden',
        'proposal.created',
      ]);

      for (const entry of result.activity) {
        expect((entry.payload as Record<string, unknown>)['reason']).toContain('wrong deposit');
      }

      const original = await service.getProposal(originalId);
      expect(original.status).toBe('accepted');
      expect(original.decidedBy).toBe(ACTOR_A);
      expect(original.supersededBy).toBe(result.proposal.id);

      const replacement = await service.getProposal(result.proposal.id);
      expect(replacement.sources.length).toBe(original.sources.length);
      expect(replacement.evidence.length).toBe(original.evidence.length);
      expect(
        (replacement.rationale as Record<string, unknown>)['previousProposalId'],
      ).toBe(originalId);

      await expect(
        service.overrideProposal(originalId, ACTOR_B, { reason: 'Should fail after superseding' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('invalid transitions', () => {
    it('refuses to approve an already rejected proposal', async () => {
      const proposalId = await seedPendingProposal();
      await service.rejectProposal(proposalId, ACTOR_A, { reason: 'Duplicate of another match' });

      await expect(service.approveProposal(proposalId, ACTOR_B, {})).rejects.toThrow(
        /Invalid transition: cannot approve a proposal with status 'rejected'/,
      );
    });

    it('refuses to reject an already accepted proposal', async () => {
      const proposalId = await seedPendingProposal();
      await service.approveProposal(proposalId, ACTOR_A, {});

      await expect(
        service.rejectProposal(proposalId, ACTOR_B, { reason: 'Too late, already accepted' }),
      ).rejects.toThrow(/Invalid transition: cannot reject/);
    });

    it('returns not found for unknown proposals without touching the log', async () => {
      const before = await countActivity();

      await expect(
        service.approveProposal('00000000-0000-4000-8000-ffffffffffff', ACTOR_A, {}),
      ).rejects.toThrow(/was not found/);

      expect(await countActivity()).toBe(before);
    });
  });

  describe('audit chain integrity', () => {
    it('verifies a valid chain across multiple decisions', async () => {
      const first = await seedPendingProposal();
      const second = await seedPendingProposal();

      await service.approveProposal(first, ACTOR_A, { note: 'ok' });
      await service.rejectProposal(second, ACTOR_B, { reason: 'nope' });
      await service.overrideProposal(second, ACTOR_A, { reason: 'reopening with manual proposal' });

      const feed = await service.listActivity({ limit: 500 });

      expect(feed.verification.valid).toBe(true);
      expect(feed.verification.brokenAtIndex).toBeNull();
      expect(feed.entries.length).toBeGreaterThanOrEqual(5);
      expect(feed.entries[0].previousHash).toBe('0'.repeat(64));

      for (let index = 1; index < feed.entries.length; index += 1) {
        expect(feed.entries[index].previousHash).toBe(feed.entries[index - 1].hash);
      }
    });
  });

  describe('tampering detection', () => {
    it('detects a payload edited directly in the database', async () => {
      const feedBefore = await service.listActivity({ limit: 500 });
      expect(feedBefore.verification.valid).toBe(true);

      await pool.query('ALTER TABLE activity_log DISABLE TRIGGER ALL');
      try {
        const middleIndex = Math.floor(feedBefore.entries.length / 2);
        const targetId = feedBefore.entries[middleIndex].id;

        await pool.query(`UPDATE activity_log SET payload_json = jsonb_set(payload_json, '{reason}', '"tampered reason"'::jsonb) WHERE id = $1`, [
          targetId,
        ]);
      } finally {
        await pool.query('ALTER TABLE activity_log ENABLE TRIGGER ALL');
      }

      const feedAfter = await service.listActivity({ limit: 500 });
      expect(feedAfter.verification.valid).toBe(false);
      expect(feedAfter.verification.brokenAtIndex).not.toBeNull();
      expect(feedAfter.verification.reason).toContain('Recomputed hash does not match');
    });

    it('detects a broken link when an entry is removed from history', async () => {
      const chain = buildSyntheticChain(4);
      const removedMiddle = [...chain.slice(0, 2), ...chain.slice(3)];

      const result = verifyActivityChain(removedMiddle);

      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(2);
    });
  });

  describe('listExceptions', () => {
    it('returns typed exception items derived from settlements versus bank deposits', async () => {
      await seedExceptionScenario();

      const response = await service.listExceptions();

      expect(response.totalSettlements).toBeGreaterThanOrEqual(1);
      expect(response.exceptionCount).toBe(response.items.length);
      expect(response.items.length).toBeGreaterThanOrEqual(1);

      const shortPay = response.items.find(
        (item) => item.family === 'settlement' && item.settlementReference === 'PAYOUT-EXC-1',
      );

      expect(shortPay).toBeDefined();
      expect(shortPay?.exceptionType).toBe('short_pay');
      expect(shortPay?.family).toBe('settlement');
      expect(shortPay?.outcome).toBe('short_pay');
      expect(shortPay?.varianceCents).toBe(-30_000);
      expect(shortPay?.status).toBe('open');
      expect(shortPay?.confidence).toBeNull();
      expect(shortPay?.settlement).toMatchObject({
        grossCents: 1_300_000,
        feesCents: -20_000,
        expectedNetCents: 1_280_000,
      });
      expect(shortPay?.settlement?.lines.length).toBe(2);

      const bankEvidence = shortPay?.evidence.find((entry) => entry.label === 'bank_link');
      expect(bankEvidence).toBeDefined();
      expect(bankEvidence?.target?.sourceType).toBe('bank_transaction');

      const explanationCause = shortPay?.causes.find(
        (cause) => cause.causeType === 'directional_gap',
      );
      expect(explanationCause).toBeDefined();

      const unmatched = response.items.find(
        (item) =>
          item.exceptionType === 'unmatched' &&
          item.settlementReference === 'PAYOUT-EXC-1',
      );
      expect(unmatched).toBeDefined();
      expect(unmatched?.amountCents).toBe(1_250_000);
      expect(unmatched?.relatedRecords[0]?.sourceType).toBe('bank_transaction');

      const countedTotal = Object.values(response.counts).reduce((sum, count) => sum + count, 0);
      expect(countedTotal).toBe(response.items.length);
    });

    it('flags duplicate candidates when one record is proposed for several movements', async () => {
      const { ledgerId } = await seedCandidateRecords();
      const firstProposal = await seedPendingProposal();
      const secondProposal = await seedPendingProposal();

      await connection.db.insert(proposalLinks).values([
        { proposalId: firstProposal, sourceType: 'ledger_entry', recordId: ledgerId },
        { proposalId: secondProposal, sourceType: 'ledger_entry', recordId: ledgerId },
      ]);

      const response = await service.listExceptions();

      const duplicate = response.items.find((item) => item.exceptionType === 'duplicate_candidate');

      expect(duplicate).toBeDefined();
      expect(duplicate?.detail).toContain('proposed for 2');
      expect(duplicate?.relatedRecords.some((record) => record.sourceType === 'ledger_entry')).toBe(true);
      expect(duplicate?.relatedRecords.filter((record) => record.sourceType === 'proposal').length).toBe(2);
      expect(response.counts.duplicate_candidate).toBeGreaterThanOrEqual(1);
    });

    it('flags ambiguous engine matches as ambiguous_match', async () => {
      const proposalId = await seedPendingProposal();

      await connection.db
        .update(reconciliationProposals)
        .set({
          method: 'fuzzy',
          rationaleJson: {
            type: 'engine_match',
            summary: 'Two invoices tie on amount and vendor',
            ambiguous: true,
            features: [{ name: 'date', tier: 'same_day', score: 1, detail: 'Same calendar day' }],
          },
        })
        .where(eq(reconciliationProposals.id, proposalId));

      const response = await service.listExceptions();

      const ambiguous = response.items.find(
        (item) => item.exceptionType === 'ambiguous_match' && item.proposalId === proposalId,
      );

      expect(ambiguous).toBeDefined();
      expect(ambiguous?.status).toBe('in_review');
      expect(ambiguous?.confidence).toBeCloseTo(0.92);
      expect(ambiguous?.detail).toContain('tie');
    });

    it('flags proposals whose date signal is weak as date_mismatch', async () => {
      const proposalId = await seedPendingProposal();

      await connection.db
        .update(reconciliationProposals)
        .set({
          rationaleJson: {
            type: 'engine_match',
            summary: 'Amount and vendor agree',
            ambiguous: false,
            features: [
              { name: 'date', tier: 'within_5_days', score: 0.8, detail: '4 days apart' },
            ],
          },
        })
        .where(eq(reconciliationProposals.id, proposalId));

      const response = await service.listExceptions();

      const dateMismatch = response.items.find(
        (item) => item.exceptionType === 'date_mismatch' && item.proposalId === proposalId,
      );

      expect(dateMismatch).toBeDefined();
      expect(dateMismatch?.detail).toBe('4 days apart');
    });
  });

  describe('AI assistance', () => {
    const ORIGINAL_KEY = process.env['OPENAI_API_KEY'];

    afterEach(() => {
      if (ORIGINAL_KEY === undefined) {
        delete process.env['OPENAI_API_KEY'];
      } else {
        process.env['OPENAI_API_KEY'] = ORIGINAL_KEY;
      }

      jest.restoreAllMocks();
    });

    function validModelOutput(): Record<string, unknown> {
      return {
        recommendation: 'The bank movement aligns with the supplied evidence.',
        confidence: 0.72,
        reasoning: 'The bank ref [bank] matches the recorded payout identifier; [evidence:0] supports it.',
        supportingEvidence: ['bank', 'evidence:0', 'ghost:99'],
        contradictingEvidence: [],
        recommendedAction: 'investigate_further',
      };
    }

    async function seedAmbiguousProposal(): Promise<string> {
      importCounter += 1;
      rowCounter += 1;

      const [record] = await connection.db
        .insert(imports)
        .values({
          type: 'bank',
          filename: `ai-bank-${importCounter}.csv`,
          rowCount: 1,
          contentHash: `ai-bank-${Date.now()}-${importCounter}`,
        })
        .returning({ id: imports.id });

      const [bank] = await connection.db
        .insert(bankTransactions)
        .values({
          importId: record.id,
          externalReference: `AI-PAYOUT-${rowCounter}`,
          postedAt: new Date('2026-08-22T10:00:00Z'),
          amountCents: 640000,
          currency: 'USD',
          description: 'Stripe payout (ambiguous)',
          normalizedVendor: 'STRIPE',
          rawJson: {},
          sourceRow: 1,
          contentHash: `ai-bank-row-${Date.now()}-${rowCounter}-${importCounter}`,
        })
        .returning({ id: bankTransactions.id });

      const [proposal] = await connection.db
        .insert(reconciliationProposals)
        .values({
          status: 'pending',
          method: 'fuzzy',
          score: 0.75,
          rationaleJson: {
            type: 'engine_match',
            summary: 'Two candidates tie',
            ambiguous: true,
            matchedFields: ['amount'],
            mismatchedFields: ['date'],
            features: [{ name: 'vendor', tier: 'fuzzy', score: 0.85, detail: 'Vendor fuzzy match' }],
          },
        })
        .returning({ id: reconciliationProposals.id });

      await connection.db.insert(proposalLinks).values({
        proposalId: proposal.id,
        sourceType: 'bank_transaction',
        recordId: bank.id,
      });

      await connection.db.insert(evidence).values({
        proposalId: proposal.id,
        sourceType: 'bank_transaction',
        sourceId: bank.id,
        evidenceType: 'vendor_fuzzy',
        detail: 'Vendor name matched at 0.85 similarity',
      });

      return proposal.id;
    }

    it('reports availability based purely on the API key environment variable', () => {
      delete process.env['OPENAI_API_KEY'];
      expect(service.getAiStatus()).toEqual({ available: false, model: null });

      process.env['OPENAI_API_KEY'] = 'test-key';
      expect(service.getAiStatus().available).toBe(true);
      expect(typeof service.getAiStatus().model).toBe('string');
    });

    it('refuses to explain proposals outside the ambiguous 0.60-0.89 band without calling the provider', async () => {
      const providerSpy = jest.spyOn(aiProvider, 'completeJson');
      process.env['OPENAI_API_KEY'] = 'test-key';

      const highScoreId = await seedPendingProposal();

      await expect(service.explainProposalWithAi(highScoreId)).rejects.toThrow(BadRequestException);
      expect(providerSpy).not.toHaveBeenCalled();
    });

    it('explains an eligible ambiguous proposal, dropping evidence refs that were never supplied', async () => {
      process.env['OPENAI_API_KEY'] = 'test-key';
      const proposalId = await seedAmbiguousProposal();

      jest.spyOn(aiProvider, 'completeJson').mockResolvedValue(validModelOutput());

      const activityBefore = await countActivity();

      const result = await service.explainProposalWithAi(proposalId);

      expect(result.recommendedAction).toBe('investigate_further');
      expect(result.confidence).toBeCloseTo(0.72);
      expect(result.supportingEvidence.map((entry) => entry.ref)).toEqual(['bank', 'evidence:0']);
      expect(
        result.supportingEvidence.every((entry) => entry.label.length > 0 && entry.label !== entry.ref),
      ).toBe(true);

      const activityAfter = await countActivity();
      expect(activityAfter).toBe(activityBefore);
    });

    it('surfaces a service error when the model returns malformed output', async () => {
      process.env['OPENAI_API_KEY'] = 'test-key';
      const proposalId = await seedAmbiguousProposal();

      jest.spyOn(aiProvider, 'completeJson').mockResolvedValue({ unexpected: true });

      await expect(service.explainProposalWithAi(proposalId)).rejects.toThrow(/AI assistance failed/);
    });

    it('summarizes a computed exception with the same structured contract', async () => {
      process.env['OPENAI_API_KEY'] = 'test-key';
      await seedExceptionScenario();

      const feed = await service.listExceptions();
      const settlementItem = feed.items.find((item) => item.family === 'settlement');

      expect(settlementItem).toBeDefined();

      jest
        .spyOn(aiProvider, 'completeJson')
        .mockResolvedValue({ ...validModelOutput(), recommendedAction: 'escalate_to_provider' });

      const result = await service.summarizeExceptionWithAi(settlementItem!.id);

      expect(result.recommendedAction).toBe('escalate_to_provider');
      expect(result.supportingEvidence.length).toBeLessThanOrEqual(3);
    });

    it('rejects unknown exception ids', async () => {
      process.env['OPENAI_API_KEY'] = 'test-key';

      await expect(service.summarizeExceptionWithAi('settlement:does-not-exist')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRecordDetail', () => {
    it('returns fields, provenance and related proposals for a bank transaction', async () => {
      const proposalId = await seedPendingProposal();
      const [link] = await connection.db
        .select({ recordId: proposalLinks.recordId })
        .from(proposalLinks)
        .where(eq(proposalLinks.proposalId, proposalId))
        .limit(1);

      const detail = await service.getRecordDetail({
        sourceType: 'bank_transaction',
        recordId: link.recordId,
      });

      expect(detail.title).toContain('Stripe payout');
      expect(detail.fields.some((field) => field.label === 'Amount')).toBe(true);
      expect(detail.importFilename).toContain('seed-bank');
      expect(detail.relatedProposals.some((proposal) => proposal.id === proposalId)).toBe(true);
    });

    it('resolves a settlement line with its parent settlement', async () => {
      await seedExceptionScenario();

      const [line] = await connection.db
        .select()
        .from(settlementLines)
        .where(eq(settlementLines.type, 'fee'))
        .limit(1);

      const detail = await service.getRecordDetail({
        sourceType: 'settlement_line',
        recordId: line.id,
      });

      expect(detail.parent).not.toBeNull();
      expect(detail.parent?.label).toContain('PAYOUT-EXC-1');

      if (detail.parent) {
        const parent = await service.getRecordDetail({
          sourceType: 'settlement',
          recordId: detail.parent.recordId,
        });

        expect(parent.fields.map((field) => field.label)).toEqual([
          'Provider',
          'Reference',
          'Settlement date',
          'Gross',
          'Fees',
          'Refunds',
          'Deductions',
          'Adjustments',
          'Expected net',
        ]);
      }
    });

    it('throws not found for unknown records', async () => {
      await expect(
        service.getRecordDetail({
          sourceType: 'invoice',
          recordId: '00000000-0000-4000-8000-ffffffffffff',
        }),
      ).rejects.toThrow(/was not found/);
    });
  });

  describe('generate proposals', () => {
    it('creates pending proposals only for bank transactions without one, and is idempotent', async () => {
      const before = await service.getWorklist({ status: 'pending', page: 1, limit: 1 });
      await seedCandidateRecords();

      const firstRun = await service.generateProposalsForUnmatched();
      expect(firstRun.created).toBeGreaterThanOrEqual(0);
      expect(firstRun.scannedBanks).toBeGreaterThanOrEqual(0);

      const secondRun = await service.generateProposalsForUnmatched();
      expect(secondRun.created).toBe(0);

      const after = await service.getSummary();
      expect(after.totalProposals).toBeGreaterThanOrEqual(before.total);
    });
  });

  describe('summary', () => {
    it('reports status counts, unmatched banks and unresolved value', async () => {
      const pendingId = await seedPendingProposal();
      const acceptedId = await seedPendingProposal();

      await service.approveProposal(acceptedId, ACTOR_A, { note: 'ok' });
      await service.rejectProposal(pendingId, ACTOR_B, { reason: 'not this one' });

      const summary = await service.getSummary();

      expect(summary.totalProposals).toBe(
        summary.pending + summary.accepted + summary.rejected,
      );
      expect(summary.accepted).toBeGreaterThanOrEqual(1);
      expect(summary.rejected).toBeGreaterThanOrEqual(1);
      expect(summary.overridden).toBeGreaterThanOrEqual(0);
      expect(summary.unmatchedBankTransactions).toBeGreaterThanOrEqual(1);
      expect(Number(summary.unresolvedValueCents)).toBeGreaterThan(0);
      expect(summary.totalBankTransactions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('worklist', () => {
    it('merges proposal rows with unmatched bank transactions sorted by date descending', async () => {
      await seedPendingProposal();

      const page = await service.getWorklist({ status: 'all', page: 1, limit: 100 });

      expect(page.items.length).toBeGreaterThan(0);

      for (let index = 1; index < page.items.length; index += 1) {
        expect(page.items[index - 1].date >= page.items[index].date).toBe(true);
      }

      const statuses = new Set(page.items.map((item) => item.status));
      expect(statuses.size).toBeGreaterThanOrEqual(1);
    });

    it('returns only unmatched banks when filtered to unmatched', async () => {
      await seedPendingProposal();

      const page = await service.getWorklist({ status: 'unmatched', page: 1, limit: 50 });

      expect(page.items.length).toBeGreaterThan(0);

      for (const item of page.items) {
        expect(item.kind).toBe('unmatched');
        expect(item.proposalId).toBeNull();
        expect(item.status).toBe('unmatched');
      }
    });

    it('filters by status and exposes reviewer and rationale on decided rows', async () => {
      const id = await seedPendingProposal();
      await service.approveProposal(id, ACTOR_A, {});

      const page = await service.getWorklist({ status: 'accepted', page: 1, limit: 50 });

      expect(page.items.length).toBeGreaterThan(0);

      for (const item of page.items) {
        expect(item.status).toBe('accepted');
        expect(item.kind).toBe('proposal');
      }

      const decided = page.items.find((item) => item.proposalId === id);

      expect(decided?.decidedBy).toBe(ACTOR_A);
      expect(decided?.decidedAt).not.toBeNull();
      expect(typeof decided?.rationaleText).toBe('string');
    });
  });

  describe('candidates', () => {
    it('ranks alternative candidates for a proposal with signal detail', async () => {
      const proposalId = await seedPendingProposal();
      const { invoiceId } = await seedCandidateRecords();
      void invoiceId;

      const { candidates } = await service.getCandidates(proposalId);

      expect(Array.isArray(candidates)).toBe(true);

      for (const candidate of candidates) {
        expect(candidate.signals.length).toBeGreaterThan(0);
        expect(typeof candidate.score).toBe('number');
        expect(candidate.alreadyLinked).toBe(false);
      }

      for (let index = 1; index < candidates.length; index += 1) {
        expect(candidates[index - 1].score >= candidates[index].score).toBe(true);
      }
    });

    it('marks the currently linked record as already linked', async () => {
      const proposalId = await seedPendingProposal();
      const { invoiceId } = await seedCandidateRecords();

      await connection.db.insert(proposalLinks).values({
        proposalId,
        sourceType: 'invoice',
        recordId: invoiceId,
      });

      const { candidates } = await service.getCandidates(proposalId);
      const linkedCandidate = candidates.find((candidate) => candidate.recordId === invoiceId);

      if (linkedCandidate) {
        expect(linkedCandidate.alreadyLinked).toBe(true);
      }
    });
  });

  describe('override with an alternative candidate', () => {
    it('creates a manual proposal linked to the selected candidate and records selection evidence', async () => {
      const originalId = await seedPendingProposal();
      const { invoiceId } = await seedCandidateRecords();

      const result = await service.overrideProposal(originalId, ACTOR_B, {
        reason: 'The invoice is the correct counterpart',
        candidateSourceType: 'invoice',
        candidateRecordId: invoiceId,
      });

      expect(result.proposal.method).toBe('manual');
      expect(result.proposal.sources.some((s) => s.sourceType === 'invoice' && s.recordId === invoiceId)).toBe(true);
      expect(result.proposal.sources.some((s) => s.sourceType === 'bank_transaction')).toBe(true);

      const rationale = (await service.getProposal(result.proposal.id)).rationale as Record<string, unknown>;
      expect((rationale['selectedCandidate'] as Record<string, unknown>)['recordId']).toBe(invoiceId);

      const evidenceRows = await service.getEvidence(result.proposal.id);
      expect(evidenceRows.some((row) => row.evidenceType === 'manual_override_selection')).toBe(true);

      const original = await service.getProposal(originalId);
      expect(original.supersededBy).toBe(result.proposal.id);
      expect(original.status).toBe('pending');
    });

    it('rejects a candidate that does not exist', async () => {
      const originalId = await seedPendingProposal();

      await expect(
        service.overrideProposal(originalId, ACTOR_A, {
          reason: 'Selecting a phantom record should fail',
          candidateSourceType: 'invoice',
          candidateRecordId: '00000000-0000-4000-8000-ffffffffffff',
        }),
      ).rejects.toThrow(/candidate was not found/);
    });
  });


  let importCounter = 0;
  let rowCounter = 0;

  async function seedCandidateRecords(): Promise<{ invoiceId: string; ledgerId: string }> {
    importCounter += 1;

    const [invoiceImport] = await connection.db
      .insert(imports)
      .values({
        type: 'invoice',
        filename: `candidates-invoice-${importCounter}.csv`,
        rowCount: 1,
        contentHash: `cand-inv-${Date.now()}-${importCounter}`,
      })
      .returning({ id: imports.id });

    const [ledgerImport] = await connection.db
      .insert(imports)
      .values({
        type: 'ledger',
        filename: `candidates-ledger-${importCounter}.csv`,
        rowCount: 1,
        contentHash: `cand-led-${Date.now()}-${importCounter}`,
      })
      .returning({ id: imports.id });

    const [invoice] = await connection.db
      .insert(invoices)
      .values({
        importId: invoiceImport.id,
        invoiceNumber: `INV-${rowCounter}-X`,
        issuedAt: new Date('2026-08-19T00:00:00Z'),
        dueAt: null,
        amountCents: 1280000,
        currency: 'USD',
        vendor: 'Stripe Inc',
        normalizedVendor: 'STRIPE INC',
        reference: `PAYOUT-${rowCounter}`,
        rawJson: {},
        sourceRow: 1,
      })
      .returning({ id: invoices.id });

    const [ledger] = await connection.db
      .insert(ledgerEntries)
      .values({
        importId: ledgerImport.id,
        externalReference: null,
        postedAt: new Date('2026-08-21T00:00:00Z'),
        amountCents: -1280000,
        currency: 'USD',
        accountCode: '4000',
        accountName: 'Sales Clearing',
        description: 'Payout clearing entry',
        normalizedVendor: 'STRIPE',
        rawJson: {},
        sourceRow: 1,
        contentHash: `cand-led-row-${Date.now()}-${importCounter}`,
      })
      .returning({ id: ledgerEntries.id });

    return { invoiceId: invoice.id, ledgerId: ledger.id };
  }

  async function seedPendingProposal(): Promise<string> {
    importCounter += 1;
    rowCounter += 1;

    const [record] = await connection.db
      .insert(imports)
      .values({
        type: 'bank',
        filename: `seed-bank-${importCounter}.csv`,
        rowCount: 1,
        contentHash: `hash-seed-${Date.now()}-${importCounter}`,
      })
      .returning({ id: imports.id });

    const [bank] = await connection.db
      .insert(bankTransactions)
      .values({
        importId: record.id,
        externalReference: `PAYOUT-${rowCounter}`,
        postedAt: new Date('2026-08-20T10:00:00Z'),
        amountCents: 1280000,
        currency: 'USD',
        description: 'Stripe payout',
        normalizedVendor: 'STRIPE',
        rawJson: {},
        sourceRow: 1,
        contentHash: `bank-hash-${Date.now()}-${rowCounter}-${importCounter}`,
      })
      .returning({ id: bankTransactions.id });

    const [proposal] = await connection.db
      .insert(reconciliationProposals)
      .values({
        status: 'pending',
        method: 'rule',
        score: 0.92,
        rationaleJson: { type: 'engine_match', summary: 'Strong reference match' },
      })
      .returning({ id: reconciliationProposals.id });

    await connection.db.insert(proposalLinks).values({
      proposalId: proposal.id,
      sourceType: 'bank_transaction',
      recordId: bank.id,
    });

    await connection.db.insert(evidence).values({
      proposalId: proposal.id,
      sourceType: 'bank_transaction',
      sourceId: bank.id,
      evidenceType: 'reference_match',
      detail: 'External reference PAYOUT matches the payout identifier',
    });

    return proposal.id;
  }

  async function seedExceptionScenario(): Promise<void> {
    importCounter += 1;

    const [bankImport] = await connection.db
      .insert(imports)
      .values({
        type: 'bank',
        filename: `exception-bank-${importCounter}.csv`,
        rowCount: 1,
        contentHash: `exc-bank-${Date.now()}-${importCounter}`,
      })
      .returning({ id: imports.id });

    await connection.db.insert(bankTransactions).values({
      importId: bankImport.id,
      externalReference: 'PAYOUT-EXC-1',
      postedAt: new Date('2026-08-21T12:00:00Z'),
      amountCents: 1250000,
      currency: 'EUR',
      description: 'SEPA credit Stripe payout',
      normalizedVendor: 'STRIPE',
      rawJson: {},
      sourceRow: 1,
      contentHash: `exc-bank-row-${Date.now()}-${importCounter}`,
    });

    const [settlementImport] = await connection.db
      .insert(imports)
      .values({
        type: 'settlement',
        filename: `exception-settlement-${importCounter}.csv`,
        rowCount: 2,
        contentHash: `exc-settle-${Date.now()}-${importCounter}`,
      })
      .returning({ id: imports.id });

    const [settlement] = await connection.db
      .insert(settlements)
      .values({
        importId: settlementImport.id,
        provider: 'Stripe',
        settlementReference: 'PAYOUT-EXC-1',
        settlementDate: new Date('2026-08-21T00:00:00Z'),
        currency: 'EUR',
        grossAmountCents: 1300000,
        expectedNetCents: 1280000,
        feesCents: -20000,
        refundsCents: 0,
        deductionsCents: 0,
        adjustmentsCents: 0,
        rawJson: {},
        sourceRow: 1,
      })
      .returning({ id: settlements.id });

    await connection.db.insert(settlementLines).values([
      {
        settlementId: settlement.id,
        type: 'sale',
        description: 'Gross sales',
        amountCents: 1300000,
        reference: null,
        rawJson: {},
        sourceRow: 1,
      },
      {
        settlementId: settlement.id,
        type: 'fee',
        description: 'Processing fees',
        amountCents: -20000,
        reference: null,
        rawJson: {},
        sourceRow: 2,
      },
    ]);
  }

  async function fetchActivityFor(entityId: string): Promise<Array<typeof activityLog.$inferSelect>> {
    return connection.db
      .select()
      .from(activityLog)
      .where(eq(activityLog.entityId, entityId))
      .orderBy(asc(activityLog.timestamp));
  }

  async function countActivity(): Promise<number> {
    const rows = await connection.db.select().from(activityLog);

    return rows.length;
  }
});

async function applyMigrationsIfNeeded(target: Pool): Promise<void> {
  const tableCheck = await target.query(
    "SELECT to_regclass('public.users') AS existing",
  );

  if (tableCheck.rows[0]?.existing !== null) {
    return;
  }

  const migrationsDir = path.join(__dirname, '..', '..', '..', '..', 'drizzle', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await target.query(sqlText);
  }
}

async function resetTables(target: Pool): Promise<void> {
  const tables = [
    'evidence',
    'proposal_links',
    'reconciliation_proposals',
    'activity_log',
    'settlement_lines',
    'settlements',
    'invoices',
    'ledger_entries',
    'bank_transactions',
    'imports',
    'users',
  ];

  await target.query('ALTER TABLE activity_log DISABLE TRIGGER ALL');

  try {
    await target.query(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`);
  } finally {
    await target.query('ALTER TABLE activity_log ENABLE TRIGGER ALL');
  }
}

function buildSyntheticChain(length: number): ActivityChainEntry[] {
  const entries: ActivityChainEntry[] = [];
  let previousHash = '0'.repeat(64);

  for (let index = 0; index < length; index += 1) {
    const payloadJson = { sequence: index };
    const hash = computeActivityHash(previousHash, payloadJson);

    entries.push({
      id: `id-${index}`,
      actor: 'actor@example.com',
      action: 'proposal.approved',
      entityType: 'proposal',
      entityId: 'entity',
      payloadJson,
      previousHash,
      hash,
    });

    previousHash = hash;
  }

  return entries;
}

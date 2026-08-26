import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AppModule } from '../../modules/app.module';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DatabaseConnection } from '../../interfaces/database.interface';
import { DemoService } from './demo.service';
import { ReviewService } from '../reconciliation/review/review.service';

const hasDatabaseConfig =
  Boolean(process.env['DATABASE_URL']) || existsSync(resolve(process.cwd(), '.env'));

(hasDatabaseConfig ? describe : describe.skip)('Demo seed integration', () => {
  let app: INestApplicationContext;
  let demoService: DemoService;
  let reviewService: ReviewService;
  let database: DatabaseConnection;

  const countRows = async (table: string): Promise<number> => {
    const result = await database.db.execute<{ count: string }>(
      sql.raw(`select count(*)::text as count from ${table}`),
    );

    return Number(result.rows[0]?.count ?? '0');
  };

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
    demoService = app.get(DemoService);
    reviewService = app.get(ReviewService);
    database = app.get<DatabaseConnection>(DATABASE_CONNECTION);
  });

  afterAll(async () => {
    await app?.close();
    await database?.pool.end();
  });

  it('seeds raw records through the import pipeline and runs the matching engine', async () => {
    await demoService.resetDemoData();
    const result = await demoService.loadDemoData();

    expect(result.bankTransactions).toBe(10);
    expect(result.ledgerEntries).toBe(6);
    expect(result.invoices).toBe(2);
    expect(result.settlements).toBe(2);
    expect(result.settlementLines).toBe(6);
    expect(result.proposalsCreated).toBeGreaterThan(0);

    await expect(countRows('bank_transactions')).resolves.toBe(10);
    await expect(countRows('ledger_entries')).resolves.toBe(6);
    await expect(countRows('invoices')).resolves.toBe(2);
    await expect(countRows('settlements')).resolves.toBe(2);
    await expect(countRows('settlement_lines')).resolves.toBe(6);
    await expect(countRows('imports')).resolves.toBe(4);
    await expect(countRows('evidence')).resolves.toBeGreaterThan(0);
  });

  it('is idempotent: reloading produces the same dataset', async () => {
    const firstProposals = await countRows('reconciliation_proposals');
    await demoService.loadDemoData();

    await expect(countRows('bank_transactions')).resolves.toBe(10);
    await expect(countRows('ledger_entries')).resolves.toBe(6);
    await expect(countRows('reconciliation_proposals')).resolves.toBe(firstProposals);
    await expect(demoService.getStatus()).resolves.toEqual({ demoDataLoaded: true });
  });

  it('generates pending engine proposals with evidence', async () => {
    const result = await database.db.execute<{
      total: string;
      pending: string;
      hardcoded: string;
    }>(sql`
      select
        count(*)::text as total,
        count(*) filter (where status = 'pending')::text as pending,
        count(*) filter (where rationale_json->>'type' <> 'engine_match')::text as hardcoded
      from reconciliation_proposals
    `);

    const row = result.rows[0];

    expect(Number(row?.total ?? '0')).toBeGreaterThanOrEqual(9);
    expect(Number(row?.pending ?? '0')).toBe(Number(row?.total ?? '0'));
    expect(Number(row?.hardcoded ?? '0')).toBe(0);
  });

  it('contains an exact-match proposal at full score for the rent payment', async () => {
    const result = await database.db.execute<{ id: string; score: number }>(sql`
      select p.id, p.score
      from reconciliation_proposals p
      join proposal_links pl on pl.proposal_id = p.id and pl.source_type = 'bank_transaction'
      join bank_transactions b on b.id = pl.record_id
      where b.external_reference = 'RENT001'
        and b.amount_cents = 65000
        and p.method = 'exact'
      limit 1
    `);

    const row = result.rows[0];

    expect(row).toBeDefined();
    expect(Number(row?.score ?? 0)).toBe(1);

    const evidence = await database.db.execute<{ detail: string }>(sql`
      select detail from evidence where proposal_id = ${row!.id} and evidence_type = 'reference'
    `);

    expect(evidence.rows[0]?.detail).toContain('RENT001');
  });

  it('contains a fuzzy vendor-normalized proposal for the AWS purchase', async () => {
    const result = await database.db.execute<{ vendor_detail: string; amount_detail: string }>(sql`
      select
        max(ev.detail) filter (where ev.evidence_type = 'vendor') as vendor_detail,
        max(ev.detail) filter (where ev.evidence_type = 'amount') as amount_detail
      from reconciliation_proposals p
      join proposal_links pl on pl.proposal_id = p.id and pl.source_type = 'bank_transaction'
      join bank_transactions b on b.id = pl.record_id
      join evidence ev on ev.proposal_id = p.id
      where b.normalized_vendor = 'AMZN WEB SERVICES' and p.method = 'fuzzy'
    `);

    expect(result.rows[0]?.vendor_detail ?? '').toContain('AMZN WEB SERVICES');
    expect(result.rows[0]?.amount_detail ?? '').toContain('Exact amount');
  });

  it('contains a date-outside-window proposal for the seven-day-distant audit engagement', async () => {
    const result = await database.db.execute<{ date_tier: string; date_detail: string }>(sql`
      select
        max(f->>'tier') as date_tier,
        max(f->>'detail') as date_detail
      from reconciliation_proposals p
      join proposal_links pl on pl.proposal_id = p.id and pl.source_type = 'bank_transaction'
      join bank_transactions b on b.id = pl.record_id
      cross join lateral jsonb_array_elements(p.rationale_json->'features') f
      where b.external_reference = 'GC5500' and f->>'name' = 'date'
    `);

    expect(result.rows[0]?.date_tier).toBe('outside_window');
    expect(result.rows[0]?.date_detail).toContain('7 days apart');
  });

  it('marks the ambiguous stationery pair as needing review without resolving it', async () => {
    const result = await database.db.execute<{ bank_id: string }>(sql`
      select pl.record_id as bank_id
      from reconciliation_proposals p
      join proposal_links pl on pl.proposal_id = p.id and pl.source_type = 'bank_transaction'
      where (p.rationale_json->>'ambiguous')::boolean is true
      group by pl.record_id
      having count(distinct p.id) = 2
    `);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.bank_id).toBeDefined();
  });

  it('flags the exception settlement with unexplained variance', async () => {
    const exceptions = await reviewService.listExceptions();
    const variance = exceptions.items.find(
      (item) =>
        item.settlementReference === 'SET-2026-0820' && item.exceptionType === 'amount_mismatch',
    );

    expect(variance).toBeDefined();
    expect(variance?.varianceCents).toBe(-9_500);
    expect(variance?.outcome).toBe('unexplained_variance');

    const attribution = (variance?.evidence ?? []).find(
      (entry) => entry.label === 'variance_attribution',
    );

    expect(attribution?.detail).toContain('-$95.00');
  });

  it('reports unmatched banks, a date mismatch, and no missing invoice exceptions', async () => {
    const unmatched = await database.db.execute<{ description: string }>(sql`
      select b.description
      from bank_transactions b
      where not exists (
        select 1 from proposal_links pl
        where pl.record_id = b.id and pl.source_type = 'bank_transaction'
      )
      order by b.description
    `);

    expect(unmatched.rows.map((row) => row.description)).toEqual([
      'ACH debit Folio Books wholesale order',
      'Card purchase Verdant Market groceries',
    ]);

    const exceptions = await reviewService.listExceptions();

    const dateMismatch = exceptions.items.find(
      (item) => item.exceptionType === 'date_mismatch',
    );

    expect(dateMismatch).toBeDefined();
    expect(dateMismatch?.detail).toContain('7 days apart');

    const missingInvoices = exceptions.items.filter(
      (item) => item.exceptionType === 'missing_invoice',
    );

    expect(missingInvoices.length).toBe(0);
  });
});

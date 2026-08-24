import { getTableColumns } from 'drizzle-orm';
import {
  activityLog,
  bankTransactions,
  evidence,
  imports,
  importTypeEnum,
  invoices,
  ledgerEntries,
  proposalLinks,
  proposalMethodEnum,
  proposalSourceTypeEnum,
  proposalStatusEnum,
  reconciliationProposals,
  settlementLineTypeEnum,
  settlementLines,
  settlements,
} from './schema';

describe('reconciliation schema', () => {
  it('stores every monetary amount as 64-bit integer cents', () => {
    const moneyColumns = [
      getTableColumns(bankTransactions).amountCents,
      getTableColumns(ledgerEntries).amountCents,
      getTableColumns(invoices).amountCents,
      getTableColumns(settlements).grossAmountCents,
      getTableColumns(settlements).feesCents,
      getTableColumns(settlements).refundsCents,
      getTableColumns(settlements).deductionsCents,
      getTableColumns(settlements).adjustmentsCents,
      getTableColumns(settlements).expectedNetCents,
      getTableColumns(settlementLines).amountCents,
    ];

    expect(moneyColumns).toHaveLength(10);

    for (const column of moneyColumns) {
      expect(column.columnType).toMatch(/^PgBigInt\d+$/);
    }
  });

  it('never uses floating point types for money, only for confidence score', () => {
    const financialTables = [
      bankTransactions,
      ledgerEntries,
      invoices,
      settlements,
      settlementLines,
    ];
    const columnTypes = financialTables.flatMap((table) =>
      Object.values(getTableColumns(table)).map((column) => column.columnType),
    );

    expect(columnTypes).not.toContain('PgDoublePrecision');
    expect(columnTypes).not.toContain('PgReal');
    expect(getTableColumns(reconciliationProposals).score.columnType).toBe('PgDoublePrecision');
  });

  it('preserves the original source record as jsonb', () => {
    const rawPayloadColumns = [
      getTableColumns(bankTransactions).rawJson,
      getTableColumns(ledgerEntries).rawJson,
      getTableColumns(invoices).rawJson,
      getTableColumns(settlements).rawJson,
      getTableColumns(settlementLines).rawJson,
      getTableColumns(activityLog).payloadJson,
      getTableColumns(reconciliationProposals).rationaleJson,
    ];

    for (const column of rawPayloadColumns) {
      expect(column.columnType).toBe('PgJsonb');
    }
  });

  it('defines closed sets for categorical fields', () => {
    expect(importTypeEnum.enumValues).toEqual(['bank', 'ledger', 'invoice', 'settlement']);
    expect(settlementLineTypeEnum.enumValues).toEqual([
      'sale',
      'fee',
      'refund',
      'deduction',
      'adjustment',
      'reserve',
      'other',
    ]);
    expect(proposalStatusEnum.enumValues).toEqual(['pending', 'accepted', 'rejected']);
    expect(proposalMethodEnum.enumValues).toEqual(['exact', 'rule', 'fuzzy', 'llm', 'manual']);
    expect(proposalSourceTypeEnum.enumValues).toEqual([
      'bank_transaction',
      'ledger_entry',
      'invoice',
      'settlement',
      'settlement_line',
    ]);
  });

  it('models proposals as undecided until a reviewer acts', () => {
    const columns = getTableColumns(reconciliationProposals);

    expect(columns.status.hasDefault).toBe(true);
    expect(columns.decidedAt.notNull).toBe(false);
    expect(columns.decidedBy.notNull).toBe(false);
    expect(columns.supersededBy.notNull).toBe(false);
  });

  it('links proposals to records across every source type', () => {
    const keys = Object.keys(getTableColumns(proposalLinks)).sort();

    expect(keys).toEqual(['id', 'proposalId', 'recordId', 'sourceType']);
    expect(getTableColumns(proposalLinks).proposalId.notNull).toBe(true);
    expect(getTableColumns(proposalLinks).recordId.notNull).toBe(true);
  });

  it('keeps evidence tied to both its proposal and its source record', () => {
    const keys = Object.keys(getTableColumns(evidence)).sort();

    expect(keys).toEqual([
      'detail',
      'evidenceType',
      'id',
      'proposalId',
      'sourceId',
      'sourceType',
    ]);
  });

  it('hash-chains the activity log', () => {
    const columns = getTableColumns(activityLog);
    const keys = Object.keys(columns).sort();

    expect(keys).toEqual([
      'action',
      'actor',
      'entityId',
      'entityType',
      'hash',
      'id',
      'payloadJson',
      'previousHash',
      'timestamp',
    ]);
    expect(columns.previousHash.notNull).toBe(true);
    expect(columns.hash.notNull).toBe(true);
    expect(columns.entityId.notNull).toBe(true);
  });

  it('guards against duplicate imports of identical files', () => {
    const columns = getTableColumns(imports);

    expect(columns.contentHash.notNull).toBe(true);
    expect(columns.rowCount.notNull).toBe(true);
  });
});

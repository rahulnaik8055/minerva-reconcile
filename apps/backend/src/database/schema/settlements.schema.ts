import { bigint, index, integer, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { imports } from './imports.schema';

export const settlementLineTypeEnum = pgEnum('settlement_line_type', [
  'sale',
  'fee',
  'refund',
  'deduction',
  'adjustment',
  'reserve',
  'other',
]);

export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 255 }).notNull(),
    settlementReference: varchar('settlement_reference', { length: 255 }),
    settlementDate: timestamp('settlement_date', { withTimezone: true }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    grossAmountCents: bigint('gross_amount_cents', { mode: 'number' }).notNull(),
    feesCents: bigint('fees_cents', { mode: 'number' }).notNull().default(0),
    refundsCents: bigint('refunds_cents', { mode: 'number' }).notNull().default(0),
    deductionsCents: bigint('deductions_cents', { mode: 'number' }).notNull().default(0),
    adjustmentsCents: bigint('adjustments_cents', { mode: 'number' }).notNull().default(0),
    expectedNetCents: bigint('expected_net_cents', { mode: 'number' }).notNull(),
    rawJson: jsonb('raw_json').notNull(),
    sourceRow: integer('source_row').notNull(),
  },
  (table) => [
    index('settlements_import_id_idx').on(table.importId),
    index('settlements_settlement_date_idx').on(table.settlementDate),
    index('settlements_settlement_reference_idx').on(table.settlementReference),
    index('settlements_provider_idx').on(table.provider),
    index('settlements_gross_amount_cents_idx').on(table.grossAmountCents),
    uniqueIndex('settlements_import_source_row_uq').on(table.importId, table.sourceRow),
  ],
);

export const settlementLines = pgTable(
  'settlement_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => settlements.id, { onDelete: 'cascade' }),
    type: settlementLineTypeEnum('type').notNull(),
    description: varchar('description', { length: 512 }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    reference: varchar('reference', { length: 255 }),
    rawJson: jsonb('raw_json').notNull(),
    sourceRow: integer('source_row').notNull(),
  },
  (table) => [
    index('settlement_lines_settlement_id_idx').on(table.settlementId),
    index('settlement_lines_type_idx').on(table.type),
    index('settlement_lines_amount_cents_idx').on(table.amountCents),
    index('settlement_lines_reference_idx').on(table.reference),
    uniqueIndex('settlement_lines_settlement_source_row_uq').on(table.settlementId, table.sourceRow),
  ],
);

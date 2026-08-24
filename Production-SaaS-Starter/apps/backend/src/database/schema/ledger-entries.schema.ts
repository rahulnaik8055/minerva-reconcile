import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { imports } from './imports.schema';

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    externalReference: varchar('external_reference', { length: 255 }),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    accountCode: varchar('account_code', { length: 64 }).notNull(),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    normalizedVendor: varchar('normalized_vendor', { length: 255 }).notNull(),
    rawJson: jsonb('raw_json').notNull(),
    sourceRow: integer('source_row').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
  },
  (table) => [
    index('ledger_entries_import_id_idx').on(table.importId),
    index('ledger_entries_posted_at_idx').on(table.postedAt),
    index('ledger_entries_amount_cents_idx').on(table.amountCents),
    index('ledger_entries_normalized_vendor_idx').on(table.normalizedVendor),
    index('ledger_entries_external_reference_idx').on(table.externalReference),
    index('ledger_entries_account_code_idx').on(table.accountCode),
    index('ledger_entries_content_hash_idx').on(table.contentHash),
    uniqueIndex('ledger_entries_import_source_row_uq').on(table.importId, table.sourceRow),
  ],
);

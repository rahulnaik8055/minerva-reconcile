import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { imports } from './imports.schema';

export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    externalReference: varchar('external_reference', { length: 255 }),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    description: text('description').notNull(),
    normalizedVendor: varchar('normalized_vendor', { length: 255 }).notNull(),
    rawJson: jsonb('raw_json').notNull(),
    sourceRow: integer('source_row').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
  },
  (table) => [
    index('bank_transactions_import_id_idx').on(table.importId),
    index('bank_transactions_posted_at_idx').on(table.postedAt),
    index('bank_transactions_amount_cents_idx').on(table.amountCents),
    index('bank_transactions_normalized_vendor_idx').on(table.normalizedVendor),
    index('bank_transactions_external_reference_idx').on(table.externalReference),
    index('bank_transactions_content_hash_idx').on(table.contentHash),
    uniqueIndex('bank_transactions_import_source_row_uq').on(table.importId, table.sourceRow),
  ],
);

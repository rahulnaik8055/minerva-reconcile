import { bigint, index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { imports } from './imports.schema';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    invoiceNumber: varchar('invoice_number', { length: 255 }).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    vendor: varchar('vendor', { length: 255 }).notNull(),
    normalizedVendor: varchar('normalized_vendor', { length: 255 }).notNull(),
    reference: varchar('reference', { length: 255 }),
    rawJson: jsonb('raw_json').notNull(),
    sourceRow: integer('source_row').notNull(),
  },
  (table) => [
    index('invoices_import_id_idx').on(table.importId),
    index('invoices_invoice_number_idx').on(table.invoiceNumber),
    index('invoices_issued_at_idx').on(table.issuedAt),
    index('invoices_due_at_idx').on(table.dueAt),
    index('invoices_amount_cents_idx').on(table.amountCents),
    index('invoices_normalized_vendor_idx').on(table.normalizedVendor),
    index('invoices_reference_idx').on(table.reference),
    uniqueIndex('invoices_import_source_row_uq').on(table.importId, table.sourceRow),
  ],
);

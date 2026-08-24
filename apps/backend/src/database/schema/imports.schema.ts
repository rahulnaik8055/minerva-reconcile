import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const importTypeEnum = pgEnum('import_type', ['bank', 'ledger', 'invoice', 'settlement']);

export const imports = pgTable(
  'imports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: importTypeEnum('type').notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    rowCount: integer('row_count').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('imports_type_content_hash_uq').on(table.type, table.contentHash),
    index('imports_created_at_idx').on(table.createdAt),
  ],
);

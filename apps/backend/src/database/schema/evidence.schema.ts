import { index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { proposalSourceTypeEnum, reconciliationProposals } from './proposals.schema';

export const evidence = pgTable(
  'evidence',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => reconciliationProposals.id, { onDelete: 'cascade' }),
    sourceType: proposalSourceTypeEnum('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),
    evidenceType: varchar('evidence_type', { length: 64 }).notNull(),
    detail: text('detail').notNull(),
  },
  (table) => [
    index('evidence_proposal_id_idx').on(table.proposalId),
    index('evidence_source_type_source_id_idx').on(table.sourceType, table.sourceId),
  ],
);

import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { doublePrecision, index, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const proposalStatusEnum = pgEnum('proposal_status', ['pending', 'accepted', 'rejected']);

export const proposalMethodEnum = pgEnum('proposal_method', ['exact', 'rule', 'fuzzy', 'llm', 'manual']);

export const proposalSourceTypeEnum = pgEnum('proposal_source_type', [
  'bank_transaction',
  'ledger_entry',
  'invoice',
  'settlement',
  'settlement_line',
]);

export const reconciliationProposals = pgTable(
  'reconciliation_proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    status: proposalStatusEnum('status').notNull().default('pending'),
    method: proposalMethodEnum('method').notNull(),
    score: doublePrecision('score').notNull(),
    rationaleJson: jsonb('rationale_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: varchar('decided_by', { length: 255 }),
    supersededBy: uuid('superseded_by').references((): AnyPgColumn => reconciliationProposals.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('reconciliation_proposals_status_idx').on(table.status),
    index('reconciliation_proposals_method_idx').on(table.method),
    index('reconciliation_proposals_score_idx').on(table.score),
    index('reconciliation_proposals_created_at_idx').on(table.createdAt),
    index('reconciliation_proposals_decided_at_idx').on(table.decidedAt),
  ],
);

export const proposalLinks = pgTable(
  'proposal_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => reconciliationProposals.id, { onDelete: 'cascade' }),
    sourceType: proposalSourceTypeEnum('source_type').notNull(),
    recordId: uuid('record_id').notNull(),
  },
  (table) => [
    index('proposal_links_proposal_id_idx').on(table.proposalId),
    index('proposal_links_source_type_record_id_idx').on(table.sourceType, table.recordId),
    uniqueIndex('proposal_links_source_record_uq').on(table.proposalId, table.sourceType, table.recordId),
    uniqueIndex('proposal_links_single_bank_transaction_uq')
      .on(table.proposalId)
      .where(sql`${table.sourceType} = 'bank_transaction'`),
    uniqueIndex('proposal_links_single_settlement_uq')
      .on(table.proposalId)
      .where(sql`${table.sourceType} = 'settlement'`),
  ],
);

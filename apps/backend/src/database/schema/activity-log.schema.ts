import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    actor: varchar('actor', { length: 255 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    payloadJson: jsonb('payload_json'),
    previousHash: varchar('previous_hash', { length: 64 }).notNull(),
    hash: varchar('hash', { length: 64 }).notNull(),
  },
  (table) => [
    uniqueIndex('activity_log_hash_uq').on(table.hash),
    index('activity_log_timestamp_idx').on(table.timestamp),
    index('activity_log_entity_idx').on(table.entityType, table.entityId),
    index('activity_log_actor_idx').on(table.actor),
  ],
);

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../database/schema';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  pool: Pool;
  db: Database;
}

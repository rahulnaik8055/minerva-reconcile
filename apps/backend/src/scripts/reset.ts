import { NestFactory } from '@nestjs/core';
import { AppModule } from '../modules/app.module';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DatabaseConnection } from '../interfaces/database.interface';

const ALL_TABLES = [
  'evidence',
  'proposal_links',
  'reconciliation_proposals',
  'settlement_lines',
  'settlements',
  'invoices',
  'ledger_entries',
  'bank_transactions',
  'imports',
  'users',
];

async function reset(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const { pool } = app.get<DatabaseConnection>(DATABASE_CONNECTION);

  try {
    await pool.query(`truncate table ${ALL_TABLES.join(', ')} restart identity cascade`);
    console.log(`Database cleared: truncated ${ALL_TABLES.length} tables.`);
    console.log('activity_log is append-only and is preserved by design.');
    console.log('Run "npm run db:migrate" if you also want to rebuild the schema from scratch.');
  } finally {
    await app.close();
  }
}

reset().catch((error: unknown) => {
  console.error('Reset failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

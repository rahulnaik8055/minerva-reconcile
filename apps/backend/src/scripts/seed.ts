import { NestFactory } from '@nestjs/core';
import { AppModule } from '../modules/app.module';
import { DemoService } from '../modules/demo/demo.service';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const demoService = app.get(DemoService);

  try {
    const result = await demoService.loadDemoData();
    await demoService.assertExpectedRowCounts();

    console.log('Demo dataset loaded. Raw records imported through the standard import pipeline:');
    console.log(`  bank transactions : ${result.bankTransactions}`);
    console.log(`  ledger entries    : ${result.ledgerEntries}`);
    console.log(`  invoices          : ${result.invoices}`);
    console.log(`  settlements       : ${result.settlements} (${result.settlementLines} lines)`);
    console.log(`  proposals created : ${result.proposalsCreated} (by the real matching engine)`);
    console.log('Sign in and open the Reconciliation page to review them.');
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

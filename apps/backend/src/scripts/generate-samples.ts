import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  buildDemoBankCsv,
  buildDemoInvoicesCsv,
  buildDemoLedgerCsv,
  buildDemoSettlementsCsv,
} from '../modules/demo/demo-csv';

const SAMPLES_DIR = resolve(__dirname, '..', '..', 'samples');

const FILES: Array<[string, () => string]> = [
  ['bank-transactions.csv', buildDemoBankCsv],
  ['ledger-entries.csv', buildDemoLedgerCsv],
  ['invoices.csv', buildDemoInvoicesCsv],
  ['settlements.csv', buildDemoSettlementsCsv],
];

mkdirSync(SAMPLES_DIR, { recursive: true });

for (const [filename, build] of FILES) {
  writeFileSync(resolve(SAMPLES_DIR, filename), build(), 'utf8');
  console.log(`Wrote ${resolve(SAMPLES_DIR, filename)}`);
}

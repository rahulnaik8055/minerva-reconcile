import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DatabaseConnection } from '../../interfaces/database.interface';
import { ImportsService, type UploadedFile } from '../imports/imports.service';
import { ReviewService } from '../reconciliation/review/review.service';
import {
  buildDemoBankCsv,
  buildDemoInvoicesCsv,
  buildDemoLedgerCsv,
  buildDemoSettlementsCsv,
} from './demo-csv';
import {
  DEMO_BANK_ROWS,
  DEMO_INVOICE_ROWS,
  DEMO_LEDGER_ROWS,
  DEMO_SETTLEMENT_LINES,
} from './demo-dataset';

const RECONCILIATION_TABLES = [
  'evidence',
  'proposal_links',
  'reconciliation_proposals',
  'settlement_lines',
  'settlements',
  'invoices',
  'ledger_entries',
  'bank_transactions',
  'imports',
];

export interface DemoLoadResultDto {
  bankTransactions: number;
  ledgerEntries: number;
  invoices: number;
  settlementLines: number;
  settlements: number;
  proposalsCreated: number;
}

export interface DemoStatusDto {
  demoDataLoaded: boolean;
}

@Injectable()
export class DemoService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
    private readonly importsService: ImportsService,
    private readonly reviewService: ReviewService,
  ) {}

  async getStatus(): Promise<DemoStatusDto> {
    const rows = await this.database.db.execute<{ count: string }>(
      sql`select count(*)::text as count from imports where filename like 'demo-%'`,
    );

    return { demoDataLoaded: Number(rows.rows[0]?.count ?? '0') > 0 };
  }

  async loadDemoData(): Promise<DemoLoadResultDto> {
    await this.clearReconciliationData();

    const [bank, ledger, invoice, settlement] = await Promise.all([
      this.importsService.importBank(this.demoFile('demo-bank-transactions.csv', buildDemoBankCsv())),
      this.importsService.importLedger(this.demoFile('demo-ledger-entries.csv', buildDemoLedgerCsv())),
      this.importsService.importInvoices(this.demoFile('demo-invoices.csv', buildDemoInvoicesCsv())),
      this.importsService.importSettlements(
        this.demoFile('demo-settlements.csv', buildDemoSettlementsCsv()),
      ),
    ]);

    const { created } = await this.reviewService.generateProposalsForUnmatched();

    const settlementReferences = new Set(
      DEMO_SETTLEMENT_LINES.map((line) => line.settlementReference),
    );

    return {
      bankTransactions: bank.importedCount,
      ledgerEntries: ledger.importedCount,
      invoices: invoice.importedCount,
      settlementLines: settlement.importedCount,
      settlements: settlementReferences.size,
      proposalsCreated: created,
    };
  }

  async resetDemoData(): Promise<{ cleared: boolean }> {
    await this.clearReconciliationData();

    return { cleared: true };
  }

  async assertExpectedRowCounts(): Promise<void> {
    const expected = this.expectedCounts();

    for (const [table, count] of Object.entries(expected)) {
      const rows = await this.database.db.execute<{ count: string }>(
        sql.raw(`select count(*)::text as count from ${table}`),
      );

      const actual = Number(rows.rows[0]?.count ?? '0');

      if (actual !== count) {
        throw new Error(`Table ${table} holds ${actual} rows, expected ${count}`);
      }
    }
  }

  expectedCounts(): Record<string, number> {
    return {
      bank_transactions: DEMO_BANK_ROWS.length,
      ledger_entries: DEMO_LEDGER_ROWS.length,
      invoices: DEMO_INVOICE_ROWS.length,
      settlement_lines: DEMO_SETTLEMENT_LINES.length,
      imports: 4,
    };
  }

  private async clearReconciliationData(): Promise<void> {
    await this.database.pool.query(
      `truncate table ${RECONCILIATION_TABLES.join(', ')} restart identity cascade`,
    );
  }

  private demoFile(filename: string, csv: string): UploadedFile {
    const buffer = Buffer.from(csv, 'utf8');

    return { originalname: filename, mimetype: 'text/csv', size: buffer.byteLength, buffer };
  }
}

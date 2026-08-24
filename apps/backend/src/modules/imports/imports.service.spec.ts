import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DatabaseConnection } from '../../interfaces/database.interface';
import { ImportsService } from './imports.service';

const BANK_CSV = 'Posted Date,Amount,Memo\n2026-07-03,-250.00,ACME OFFICE SUPPLY INC\n';

const LEDGER_CSV_WITHOUT_DATE_COLUMN = 'Amount,Memo\n-250.00,Broken header set\n';

interface FakeReturning {
  returning: () => Promise<Array<{ id: string }>>;
}

function createFakeConnection(options?: {
  onInsert?: (values: unknown) => void;
  failImportsInsertWith?: unknown;
}): DatabaseConnection {
  let sequence = 0;

  const tx = {
    insert: (): { values: (values: unknown) => FakeReturning } => ({
      values: (values: unknown): FakeReturning => {
        if (options?.failImportsInsertWith) {
          throw options.failImportsInsertWith;
        }

        options?.onInsert?.(values);

        const ids = [{ id: `generated-${++sequence}` }];

        return Object.assign(Promise.resolve(ids), {
          returning: async (): Promise<Array<{ id: string }>> => ids,
        });
      },
    }),
  };

  const db = {
    transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => callback(tx),
  };

  return {
    pool: {} as DatabaseConnection['pool'],
    db: db as unknown as DatabaseConnection['db'],
  };
}

function csvFile(name: string, content: string): {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
} {
  return {
    originalname: name,
    mimetype: 'text/csv',
    size: content.length,
    buffer: Buffer.from(content, 'utf8'),
  };
}

describe('ImportsService', () => {
  it('returns an import summary and persists rows inside a transaction', async () => {
    const capturedValues: unknown[] = [];
    const service = new ImportsService(
      createFakeConnection({ onInsert: (values) => capturedValues.push(values) }),
    );

    const summary = await service.importBank(csvFile('acme-bank.csv', BANK_CSV));

    expect(summary).toEqual({
      filename: 'acme-bank.csv',
      type: 'bank',
      rowCount: 1,
      importedCount: 1,
      rejectedCount: 0,
      errors: [],
    });
    expect(capturedValues[0]).toMatchObject({
      type: 'bank',
      filename: 'acme-bank.csv',
      rowCount: 1,
    });
  });

  it('reports rejected rows without failing the import', async () => {
    const service = new ImportsService(createFakeConnection());

    const summary = await service.importBank(
      csvFile('mixed.csv', `${BANK_CSV}garbage,-5.00,Broken\n2026-07-04,(49.99),CloudFlake\n`),
    );

    expect(summary.rowCount).toBe(3);
    expect(summary.importedCount).toBe(2);
    expect(summary.rejectedCount).toBe(1);
    expect(summary.errors[0]).toMatchObject({ row: 3 });
    expect(summary.errors[0]?.message).toContain('postedAt');
  });

  it('conflicts when an identical file was already imported', async () => {
    const service = new ImportsService(
      createFakeConnection({
        failImportsInsertWith: { code: '23505', detail: 'duplicate key' },
      }),
    );

    await expect(service.importBank(csvFile('acme-bank.csv', BANK_CSV))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects files whose headers are missing required columns', async () => {
    const service = new ImportsService(createFakeConnection());

    await expect(
      service.importLedger(csvFile('broken.csv', LEDGER_CSV_WITHOUT_DATE_COLUMN)),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Missing required column(s): postedAt'),
    } satisfies Record<string, unknown>);
  });

  it('rejects missing or non-CSV uploads', async () => {
    const service = new ImportsService(createFakeConnection());
    const notACsv = { originalname: 'data.xlsx', mimetype: '', size: 10, buffer: Buffer.from('x') };

    await expect(service.importBank(csvFile('', ''))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.importInvoices(notACsv)).rejects.toMatchObject({
      message: 'Only CSV files are supported',
    } satisfies Record<string, unknown>);
  });

  it('rethrows unexpected persistence errors untouched', async () => {
    const service = new ImportsService(
      createFakeConnection({
        failImportsInsertWith: new Error('connection refused'),
      }),
    );

    await expect(service.importBank(csvFile('acme-bank.csv', BANK_CSV))).rejects.toThrow(
      'connection refused',
    );
  });

  it('exposes a typed transaction for plan persistence', async () => {
    const service = new ImportsService(createFakeConnection());
    const file = csvFile('settlements.csv', 'Payout Id,Payout Date,Provider,Currency,Type,Description,Amount\nS-1,2026-07-23,Stripe,USD,sale,Card payment,610.00\n');

    const summary = await service.importSettlements(file);

    expect(summary.importedCount).toBe(1);
    expect(summary.type).toBe('settlement');
  });
});

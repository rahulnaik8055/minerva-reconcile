import type { ImportPlan, ImportTransaction } from './plans';
import {
  buildBankImportPlan,
  buildInvoiceImportPlan,
  buildLedgerImportPlan,
  buildSettlementImportPlan,
} from './plans';
import { parseCsv } from './parse-csv';

interface RecordedInsert {
  values: unknown;
  returningIds: string[];
}

interface FakeReturning {
  returning: () => Promise<Array<{ id: string }>>;
}

function createRecordingTx(): { tx: ImportTransaction; inserts: RecordedInsert[] } {
  const inserts: RecordedInsert[] = [];
  let sequence = 0;

  const tx = {
    insert: (): { values: (values: unknown) => FakeReturning } => ({
      values: (values: unknown): FakeReturning => {
        const record: RecordedInsert = {
          values: values as unknown,
          returningIds: [],
        };

        inserts.push(record);

        return {
          returning: async (): Promise<Array<{ id: string }>> => {
            for (let index = 0; index < asArray(values).length; index++) {
              record.returningIds.push(`generated-${++sequence}`);
            }

            return record.returningIds.map((id) => ({ id }));
          },
        };
      },
    }),
  };

  return { tx: tx as unknown as ImportTransaction, inserts };
}

function asArray(values: unknown): unknown[] {
  return Array.isArray(values) ? values : [values];
}

async function runPlan(
  plan: ImportPlan,
  importId = 'import-1',
): Promise<{ inserts: RecordedInsert[]; importedCount: number }> {
  const recording = createRecordingTx();
  const importedCount = await plan.persist(recording.tx, importId);

  return { ...recording, importedCount };
}

describe('buildBankImportPlan', () => {
  it('normalizes and stores rows, attaching the import id to each insert', async () => {
    const plan = buildBankImportPlan(
      parseCsv('Posted Date,Amount,Currency,Memo,Reference\n2026-07-03,-250.00,,ACME OFFICE SUPPLY INC,inv-1001'),
    );

    expect(plan.rowCount).toBe(1);
    expect(plan.rejected).toEqual([]);

    const { inserts, importedCount } = await runPlan(plan);
    const row = (inserts[0]?.values as Array<Record<string, unknown>>)[0];

    expect(importedCount).toBe(1);
    expect(row?.['importId']).toBe('import-1');
    expect(row?.['amountCents']).toBe(-25000);
    expect(row?.['externalReference']).toBe('INV1001');
    expect(row?.['postedAt']).toEqual(new Date(Date.UTC(2026, 6, 3)));
    expect(row?.['normalizedVendor']).toBe('ACME OFFICE SUPPLY');
    expect(row?.['currency']).toBe('USD');
    expect(row?.['sourceRow']).toBe(2);
    expect(row?.['rawJson']).toEqual({
      'Posted Date': '2026-07-03',
      Amount: '-250.00',
      Currency: '',
      Memo: 'ACME OFFICE SUPPLY INC',
      Reference: 'inv-1001',
    });
    expect(row?.['contentHash']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects invalid rows with row numbers and messages while importing valid ones', () => {
    const plan = buildBankImportPlan(
      parseCsv(
        'Posted Date,Amount,Memo\nnot-a-date,-12.34,Broken row\n2026-07-04,(49.99),CloudFlake\n2026-07-05,bad-amount,Globex',
      ),
    );

    expect(plan.rowCount).toBe(3);
    expect(plan.rejected).toHaveLength(2);
    expect(plan.rejected[0]?.row).toBe(2);
    expect(plan.rejected[0]?.message).toContain('postedAt');
    expect(plan.rejected[1]?.row).toBe(4);
    expect(plan.rejected[1]?.message).toContain('amountCents');

    const insertedRows = plan.rejected.length === 2 ? 1 : 0;
    expect(insertedRows).toBe(1);
  });

  it('prefers an explicit vendor column over the description fallback', () => {
    const plan = buildBankImportPlan(
      parseCsv('Posted Date,Amount,Memo,Payee\n2026-07-04,-49.99,SUBSCRIPTION CHARGE,CloudFlake Inc.\n'),
    );

    expect(plan.rejected).toHaveLength(0);
  });
});

describe('buildLedgerImportPlan', () => {
  it('falls back to the account code when the account name is blank', async () => {
    const plan = buildLedgerImportPlan(
      parseCsv(
        'Entry Date,Entry Amount,GL Code,Account Title,Line Description\n2026-07-03,-250.00,6100,,Acme supplies purchase',
      ),
    );

    const { inserts, importedCount } = await runPlan(plan);
    const row = (inserts[0]?.values as Array<Record<string, unknown>>)[0];

    expect(importedCount).toBe(1);
    expect(row?.['accountCode']).toBe('6100');
    expect(row?.['accountName']).toBe('6100');
    expect(row?.['amountCents']).toBe(-25000);
  });
});

describe('buildInvoiceImportPlan', () => {
  it('parses varied date formats and normalizes the vendor', async () => {
    const plan = buildInvoiceImportPlan(
      parseCsv(
        'Invoice No,Invoice Date,Due Date,Total,Supplier,PO Number\nINV-1003,July 9 2026,,89.99,ACME OFFICE SUPPLY CO,\nINV-1005,14.07.2026,13.08.2026,"1,742.50",Umbrella Logistics,PO-97',
      ),
    );

    const { inserts } = await runPlan(plan);
    const rows = inserts[0]?.values as Array<Record<string, unknown>>;

    expect(rows[0]?.['issuedAt']).toEqual(new Date(Date.UTC(2026, 6, 9)));
    expect(rows[0]?.['dueAt']).toBeNull();
    expect(rows[0]?.['normalizedVendor']).toBe('ACME OFFICE SUPPLY');
    expect(rows[1]?.['issuedAt']).toEqual(new Date(Date.UTC(2026, 6, 14)));
    expect(rows[1]?.['dueAt']).toEqual(new Date(Date.UTC(2026, 7, 13)));
    expect(rows[1]?.['amountCents']).toBe(174250);
  });
});

describe('buildSettlementImportPlan', () => {
  const settlementCsv = [
    'Payout Id,Payout Date,Provider,Currency,Type,Description,Amount',
    'S-1,2026-07-23,Stripe,USD,sale,Card payment,610.00',
    'S-1,2026-07-23,Stripe,USD,sale,Card payment,480.00',
    'S-1,2026-07-23,Stripe,USD,refund,Partial refund,-75.00',
    'S-1,2026-07-23,Stripe,USD,fee,Processing fees,-167.55',
    'S-1,2026-07-23,Stripe,USD,fee,Platform fee,-15.00',
    'S-1,2026-07-23,Stripe,USD,deduction,Chargeback,-48.00',
    'S-2,08/29/2026,Stripe,USD,sale,Card payment,250.00',
    'S-2,08/29/2026,Stripe,USD,reserve,Rolling reserve hold,-25.00',
    'S-2,08/29/2026,Stripe,USD,fee,Fixed fee,-7.28',
    'S-2,08/29/2026,Adyen,USD,sale,Mismatched provider,10.00',
    'BROKEN,,,,,Missing everything,abc',
  ].join('\n');

  it('groups lines into settlements with signed component totals and expected net', async () => {
    const plan = buildSettlementImportPlan(parseCsv(settlementCsv));
    const { inserts, importedCount } = await runPlan(plan);

    const settlementInserts = inserts.filter((insert) =>
      (asArray(insert.values) as Array<Record<string, unknown>>).every(
        (value) => typeof value['expectedNetCents'] === 'number' && !value['settlementId'],
      ),
    );
    const lineInserts = inserts.filter((insert) =>
      (asArray(insert.values) as Array<Record<string, unknown>>).every(
        (value) => typeof value['settlementId'] === 'string' && value['settlementId'].startsWith('generated-'),
      ),
    );

    expect(settlementInserts).toHaveLength(2);
    expect(lineInserts).toHaveLength(2);

    const first = asValueArray(settlementInserts[0]?.values)[0];
    const second = asValueArray(settlementInserts[1]?.values)[0];

    expect(first?.['settlementReference']).toBe('S-1');
    expect(first?.['grossAmountCents']).toBe(109000);
    expect(first?.['feesCents']).toBe(-18255);
    expect(first?.['refundsCents']).toBe(-7500);
    expect(first?.['deductionsCents']).toBe(-4800);
    expect(first?.['adjustmentsCents']).toBe(0);
    expect(first?.['expectedNetCents']).toBe(78445);

    expect(second?.['settlementReference']).toBe('S-2');
    expect(second?.['grossAmountCents']).toBe(25000);
    expect(second?.['feesCents']).toBe(-728);
    expect(second?.['adjustmentsCents']).toBe(-2500);
    expect(second?.['expectedNetCents']).toBe(21772);

    expect(Array.isArray(first?.['rawJson'])).toBe(true);
    expect(first?.['sourceRow']).toBe(2);

    const firstLines = settlementLineValues(lineInserts[0]);
    const secondLines = settlementLineValues(lineInserts[1]);

    expect(firstLines).toHaveLength(6);
    expect(firstLines.every((line) => String(line['settlementId']).startsWith('generated-'))).toBe(true);
    expect(secondLines).toHaveLength(3);
    expect(importedCount).toBe(9);
  });

  it('rejects rows whose settlement header conflicts with earlier rows', () => {
    const plan = buildSettlementImportPlan(parseCsv(settlementCsv));
    const conflict = plan.rejected.find((rejection) => rejection.row === 11);

    expect(conflict?.message).toContain('Conflicting settlement header');
  });

  it('rejects unparseable amounts with a useful message', () => {
    const plan = buildSettlementImportPlan(parseCsv(settlementCsv));

    expect(plan.rejected.some((r) => r.row === 12 && r.message.includes('amountCents'))).toBe(true);
  });
});

function settlementLineValues(insert: RecordedInsert | undefined): Array<Record<string, unknown>> {
  return (insert?.values ?? []) as Array<Record<string, unknown>>;
}

function asValueArray(values: unknown): Array<Record<string, unknown>> {
  return Array.isArray(values) ? (values as Array<Record<string, unknown>>) : [values as Record<string, unknown>];
}

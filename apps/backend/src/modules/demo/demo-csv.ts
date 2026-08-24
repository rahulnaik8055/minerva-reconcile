import type { DemoBankRow, DemoInvoiceRow, DemoLedgerRow, DemoSettlementLineRow } from './demo-dataset';
import { DEMO_BANK_ROWS, DEMO_INVOICE_ROWS, DEMO_LEDGER_ROWS, DEMO_SETTLEMENT_LINES } from './demo-dataset';

function csvCell(value: string | number): string {
  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  return [header.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n') + '\n';
}

function formatAmount(amountCents: number): string {
  const sign = amountCents < 0 ? '-' : '';
  const absolute = Math.abs(amountCents);
  const cents = absolute % 100;
  const units = (absolute - cents) / 100;

  return `${sign}${units}.${String(cents).padStart(2, '0')}`;
}

export function buildDemoBankCsv(rows: DemoBankRow[] = DEMO_BANK_ROWS): string {
  return toCsv(
    ['Posted Date', 'Amount', 'Currency', 'Vendor', 'Description', 'Reference'],
    rows.map((row) => [
      row.postedAt,
      formatAmount(row.amountCents),
      row.currency,
      row.vendor,
      row.description,
      row.externalReference,
    ]),
  );
}

export function buildDemoLedgerCsv(rows: DemoLedgerRow[] = DEMO_LEDGER_ROWS): string {
  return toCsv(
    ['Entry Date', 'Entry Amount', 'Currency', 'GL Code', 'Account Title', 'Line Description', 'Vendor', 'Ref'],
    rows.map((row) => [
      row.postedAt,
      formatAmount(row.amountCents),
      row.currency,
      row.accountCode,
      row.accountName,
      row.description,
      row.vendor,
      row.externalReference,
    ]),
  );
}

export function buildDemoInvoicesCsv(rows: DemoInvoiceRow[] = DEMO_INVOICE_ROWS): string {
  return toCsv(
    ['Invoice No', 'Invoice Date', 'Due Date', 'Total', 'Currency', 'Supplier', 'Reference'],
    rows.map((row) => [
      row.invoiceNumber,
      row.issuedAt,
      row.dueAt,
      formatAmount(row.amountCents),
      row.currency,
      row.vendor,
      row.reference,
    ]),
  );
}

export function buildDemoSettlementsCsv(rows: DemoSettlementLineRow[] = DEMO_SETTLEMENT_LINES): string {
  return toCsv(
    ['Payout Id', 'Payout Date', 'Provider', 'Currency', 'Type', 'Description', 'Amount', 'Payment Reference'],
    rows.map((row) => [
      row.settlementReference,
      row.settlementDate,
      row.provider,
      row.currency,
      row.type,
      row.description,
      formatAmount(row.amountCents),
      row.reference,
    ]),
  );
}

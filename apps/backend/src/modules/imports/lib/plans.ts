import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { NodePgTransaction } from 'drizzle-orm/node-postgres';
import {
  bankTransactions,
  invoices,
  ledgerEntries,
  settlementLines,
  settlements,
} from '../../../database/schema';
import type * as schema from '../../../database/schema';
import { assertRequiredColumns, extractRowValues, resolveHeaders } from './column-mapper';
import {
  BANK_COLUMN_ALIASES,
  BANK_REQUIRED_COLUMNS,
  INVOICE_COLUMN_ALIASES,
  INVOICE_REQUIRED_COLUMNS,
  LEDGER_COLUMN_ALIASES,
  LEDGER_REQUIRED_COLUMNS,
  SETTLEMENT_COLUMN_ALIASES,
  SETTLEMENT_REQUIRED_COLUMNS,
} from './column-specs';
import { hashRecord } from './hashing';
import { normalizeVendorName } from './normalize';
import type { ParseResult } from './parse-csv';
import { formatRowIssues } from './row-schemas';
import type { SettlementLineTypeValue } from './row-schemas';
import { bankRowSchema, invoiceRowSchema, ledgerRowSchema, settlementLineRowSchema } from './row-schemas';

export interface PlanRejection {
  row: number;
  message: string;
}

export type ImportTransaction = NodePgTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export interface ImportPlan {
  rowCount: number;
  rejected: PlanRejection[];
  persist: (tx: ImportTransaction, importId: string) => Promise<number>;
}

function collectSyntaxErrors(parsed: ParseResult): PlanRejection[] {
  return parsed.syntaxErrors.map((error) => ({
    row: error.rowNumber ?? 0,
    message: `CSV syntax error - ${error.message}`,
  }));
}

export function buildBankImportPlan(parsed: ParseResult): ImportPlan {
  assertRequiredColumns(parsed.headers, BANK_COLUMN_ALIASES, BANK_REQUIRED_COLUMNS);
  const { columnByCanonical } = resolveHeaders(parsed.headers, BANK_COLUMN_ALIASES);

  const rejected = collectSyntaxErrors(parsed);
  const rowsToInsert: Array<Omit<typeof bankTransactions.$inferInsert, 'importId'>> = [];

  for (const csvRow of parsed.rows) {
    const result = bankRowSchema.safeParse(extractRowValues(csvRow.values, columnByCanonical));

    if (!result.success) {
      rejected.push({ row: csvRow.rowNumber, message: formatRowIssues(result.error) });
      continue;
    }

    const values = result.data;

    rowsToInsert.push({
      externalReference: values.externalReference,
      postedAt: values.postedAt,
      amountCents: values.amountCents,
      currency: values.currency,
      description: values.description,
      normalizedVendor: values.vendor ?? normalizeVendorName(values.description),
      rawJson: csvRow.values,
      sourceRow: csvRow.rowNumber,
      contentHash: hashRecord(csvRow.values),
    });
  }

  return {
    rowCount: parsed.rows.length,
    rejected,
    persist: async (tx, importId): Promise<number> => {
      const withImportId = rowsToInsert.map((row) => ({ ...row, importId }));

      if (withImportId.length > 0) {
        await tx.insert(bankTransactions).values(withImportId);
      }

      return withImportId.length;
    },
  };
}

export function buildLedgerImportPlan(parsed: ParseResult): ImportPlan {
  assertRequiredColumns(parsed.headers, LEDGER_COLUMN_ALIASES, LEDGER_REQUIRED_COLUMNS);
  const { columnByCanonical } = resolveHeaders(parsed.headers, LEDGER_COLUMN_ALIASES);

  const rejected = collectSyntaxErrors(parsed);
  const rowsToInsert: Array<Omit<typeof ledgerEntries.$inferInsert, 'importId'>> = [];

  for (const csvRow of parsed.rows) {
    const result = ledgerRowSchema.safeParse(extractRowValues(csvRow.values, columnByCanonical));

    if (!result.success) {
      rejected.push({ row: csvRow.rowNumber, message: formatRowIssues(result.error) });
      continue;
    }

    const values = result.data;

    rowsToInsert.push({
      externalReference: values.externalReference,
      postedAt: values.postedAt,
      amountCents: values.amountCents,
      currency: values.currency,
      accountCode: values.accountCode,
      accountName: values.accountName || values.accountCode,
      description: values.description,
      normalizedVendor: values.vendor ?? normalizeVendorName(values.description),
      rawJson: csvRow.values,
      sourceRow: csvRow.rowNumber,
      contentHash: hashRecord(csvRow.values),
    });
  }

  return {
    rowCount: parsed.rows.length,
    rejected,
    persist: async (tx, importId): Promise<number> => {
      const withImportId = rowsToInsert.map((row) => ({ ...row, importId }));

      if (withImportId.length > 0) {
        await tx.insert(ledgerEntries).values(withImportId);
      }

      return withImportId.length;
    },
  };
}

export function buildInvoiceImportPlan(parsed: ParseResult): ImportPlan {
  assertRequiredColumns(parsed.headers, INVOICE_COLUMN_ALIASES, INVOICE_REQUIRED_COLUMNS);
  const { columnByCanonical } = resolveHeaders(parsed.headers, INVOICE_COLUMN_ALIASES);

  const rejected = collectSyntaxErrors(parsed);
  const rowsToInsert: Array<Omit<typeof invoices.$inferInsert, 'importId'>> = [];

  for (const csvRow of parsed.rows) {
    const result = invoiceRowSchema.safeParse(extractRowValues(csvRow.values, columnByCanonical));

    if (!result.success) {
      rejected.push({ row: csvRow.rowNumber, message: formatRowIssues(result.error) });
      continue;
    }

    const values = result.data;

    rowsToInsert.push({
      invoiceNumber: values.invoiceNumber,
      issuedAt: values.issuedAt,
      dueAt: values.dueAt ?? null,
      amountCents: values.amountCents,
      currency: values.currency,
      vendor: values.vendor,
      normalizedVendor: normalizeVendorName(values.vendor),
      reference: values.reference,
      rawJson: csvRow.values,
      sourceRow: csvRow.rowNumber,
    });
  }

  return {
    rowCount: parsed.rows.length,
    rejected,
    persist: async (tx, importId): Promise<number> => {
      const withImportId = rowsToInsert.map((row) => ({ ...row, importId }));

      if (withImportId.length > 0) {
        await tx.insert(invoices).values(withImportId);
      }

      return withImportId.length;
    },
  };
}

interface ValidatedSettlementLine {
  sourceRow: number;
  rawJson: Record<string, string>;
  settlementReference: string;
  settlementDate: Date;
  provider: string;
  currency: string;
  type: SettlementLineTypeValue;
  description: string;
  amountCents: number;
  reference: string | null;
}

interface SettlementGroup {
  settlementReference: string;
  settlementDate: Date;
  provider: string;
  currency: string;
  lines: ValidatedSettlementLine[];
}

export function groupSettlementLines(
  lines: ValidatedSettlementLine[],
): Map<string, SettlementGroup> {
  const groups = new Map<string, SettlementGroup>();

  for (const line of lines) {
    let group = groups.get(line.settlementReference);

    if (!group) {
      group = {
        settlementReference: line.settlementReference,
        settlementDate: line.settlementDate,
        provider: line.provider,
        currency: line.currency,
        lines: [],
      };
      groups.set(line.settlementReference, group);
    }

    group.lines.push(line);
  }

  return groups;
}

export function summarizeSettlement(
  group: SettlementGroup,
): Omit<typeof settlements.$inferInsert, 'importId'> {
  const sumOfType = (types: readonly string[]): number =>
    group.lines
      .filter((line) => types.includes(line.type))
      .reduce((total, line) => total + line.amountCents, 0);

  const grossAmountCents = sumOfType(['sale']);
  const feesCents = sumOfType(['fee']);
  const refundsCents = sumOfType(['refund']);
  const deductionsCents = sumOfType(['deduction']);
  const adjustmentsCents = sumOfType(['adjustment', 'reserve', 'other']);

  return {
    provider: group.provider,
    settlementReference: group.settlementReference,
    settlementDate: group.settlementDate,
    currency: group.currency,
    grossAmountCents,
    feesCents,
    refundsCents,
    deductionsCents,
    adjustmentsCents,
    expectedNetCents:
      grossAmountCents + feesCents + refundsCents + deductionsCents + adjustmentsCents,
    rawJson: group.lines.map((line) => line.rawJson),
    sourceRow: group.lines[0]?.sourceRow ?? 0,
  };
}

export function buildSettlementImportPlan(parsed: ParseResult): ImportPlan {
  assertRequiredColumns(parsed.headers, SETTLEMENT_COLUMN_ALIASES, SETTLEMENT_REQUIRED_COLUMNS);
  const { columnByCanonical } = resolveHeaders(parsed.headers, SETTLEMENT_COLUMN_ALIASES);

  const rejected = collectSyntaxErrors(parsed);
  const validatedLines: ValidatedSettlementLine[] = [];

  for (const csvRow of parsed.rows) {
    const result = settlementLineRowSchema.safeParse(
      extractRowValues(csvRow.values, columnByCanonical),
    );

    if (!result.success) {
      rejected.push({ row: csvRow.rowNumber, message: formatRowIssues(result.error) });
      continue;
    }

    validatedLines.push({ ...result.data, sourceRow: csvRow.rowNumber, rawJson: csvRow.values });
  }

  const rejectedRows = new Set(rejected.map((rejection) => rejection.row));

  for (const group of groupSettlementLines(validatedLines).values()) {
    for (const line of group.lines.slice(1)) {
      if (
        line.provider !== group.provider ||
        line.currency !== group.currency ||
        line.settlementDate.getTime() !== group.settlementDate.getTime()
      ) {
        rejected.push({
          row: line.sourceRow,
          message: `Conflicting settlement header for ${group.settlementReference}: provider, date, or currency differs from earlier rows`,
        });
        rejectedRows.add(line.sourceRow);
      }
    }
  }

  const consistentLines = validatedLines.filter((line) => !rejectedRows.has(line.sourceRow));

  return {
    rowCount: parsed.rows.length,
    rejected,
    persist: async (tx, importId): Promise<number> => {
      let insertedCount = 0;

      for (const group of groupSettlementLines(consistentLines).values()) {
        const [settlement] = await tx
          .insert(settlements)
          .values({ ...summarizeSettlement(group), importId })
          .returning({ id: settlements.id });

        if (!settlement) {
          continue;
        }

        const linesToInsert = group.lines.map((line) => ({
          settlementId: settlement.id,
          type: line.type,
          description: line.description,
          amountCents: line.amountCents,
          reference: line.reference,
          rawJson: line.rawJson,
          sourceRow: line.sourceRow,
        }));

        await tx.insert(settlementLines).values(linesToInsert);
        insertedCount += linesToInsert.length;
      }

      return insertedCount;
    },
  };
}

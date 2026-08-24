import { ConflictException, BadRequestException, Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { imports } from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { DatabaseConnection } from '../../interfaces/database.interface';
import { HeaderValidationError } from './lib/column-mapper';
import { sha256Hex } from './lib/hashing';
import type { ParseResult } from './lib/parse-csv';
import { parseCsv } from './lib/parse-csv';
import type { ImportPlan, PlanRejection } from './lib/plans';
import {
  buildBankImportPlan,
  buildInvoiceImportPlan,
  buildLedgerImportPlan,
  buildSettlementImportPlan,
} from './lib/plans';
import { ImportSummaryDto, ImportErrorDto } from './dto/import-summary.dto';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

type ImportType = 'bank' | 'ledger' | 'invoice' | 'settlement';

@Injectable()
export class ImportsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection) {}

  async importBank(file: UploadedFile): Promise<ImportSummaryDto> {
    return this.runImport('bank', file, buildBankImportPlan);
  }

  async importLedger(file: UploadedFile): Promise<ImportSummaryDto> {
    return this.runImport('ledger', file, buildLedgerImportPlan);
  }

  async importInvoices(file: UploadedFile): Promise<ImportSummaryDto> {
    return this.runImport('invoice', file, buildInvoiceImportPlan);
  }

  async importSettlements(file: UploadedFile): Promise<ImportSummaryDto> {
    return this.runImport('settlement', file, buildSettlementImportPlan);
  }

  private async runImport(
    type: ImportType,
    file: UploadedFile,
    buildPlan: (parsed: ParseResult) => ImportPlan,
  ): Promise<ImportSummaryDto> {
    assertCsvUpload(file);

    const contentHash = sha256Hex(file.buffer);
    const parsed = parseCsv(file.buffer.toString('utf8'));

    let plan: ImportPlan;

    try {
      plan = buildPlan(parsed);
    } catch (error) {
      if (error instanceof HeaderValidationError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    let importedCount = 0;

    try {
      importedCount = await this.database.db.transaction(async (tx) => {
        const [record] = await tx
          .insert(imports)
          .values({
            type,
            filename: file.originalname,
            rowCount: plan.rowCount,
            contentHash,
          })
          .returning({ id: imports.id });

        return record ? plan.persist(tx, record.id) : 0;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`An identical ${type} import already exists`);
      }

      throw error;
    }

    return toSummary(file.originalname, type, plan.rowCount, importedCount, plan.rejected);
  }
}

function assertCsvUpload(file: UploadedFile): void {
  if (!file || file.size === 0) {
    throw new BadRequestException('No CSV file was uploaded');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestException('Uploaded file exceeds the 5 MB size limit');
  }

  const hasCsvExtension = file.originalname.toLowerCase().endsWith('.csv');
  const hasCsvMimeType = /text\/(csv|plain)/.test(file.mimetype);

  if (!hasCsvExtension && !hasCsvMimeType) {
    throw new BadRequestException('Only CSV files are supported');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

function toSummary(
  filename: string,
  type: ImportType,
  rowCount: number,
  importedCount: number,
  rejections: PlanRejection[],
): ImportSummaryDto {
  return {
    filename,
    type,
    rowCount,
    importedCount,
    rejectedCount: rejections.length,
    errors: rejections.map((rejection) => ({
      row: rejection.row,
      message: rejection.message,
    }) as ImportErrorDto),
  };
}

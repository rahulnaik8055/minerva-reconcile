import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ImportsService } from './imports.service';
import { ImportSummaryDto } from './dto/import-summary.dto';

const UPLOAD_BODY_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string', format: 'binary' },
  },
  required: ['file'],
};

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('bank')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import bank transactions from a CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_BODY_SCHEMA })
  @ApiOkResponse({ description: 'Import processed', type: ImportSummaryDto })
  @ApiBadRequestResponse({ description: 'Invalid upload or missing required columns' })
  @ApiConflictResponse({ description: 'An identical import already exists' })
  importBank(@UploadedFile() file: Express.Multer.File): Promise<ImportSummaryDto> {
    return this.importsService.importBank(file);
  }

  @Post('ledger')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import ledger entries from a CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_BODY_SCHEMA })
  @ApiOkResponse({ description: 'Import processed', type: ImportSummaryDto })
  @ApiBadRequestResponse({ description: 'Invalid upload or missing required columns' })
  @ApiConflictResponse({ description: 'An identical import already exists' })
  importLedger(@UploadedFile() file: Express.Multer.File): Promise<ImportSummaryDto> {
    return this.importsService.importLedger(file);
  }

  @Post('invoices')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import invoices from a CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_BODY_SCHEMA })
  @ApiOkResponse({ description: 'Import processed', type: ImportSummaryDto })
  @ApiBadRequestResponse({ description: 'Invalid upload or missing required columns' })
  @ApiConflictResponse({ description: 'An identical import already exists' })
  importInvoices(@UploadedFile() file: Express.Multer.File): Promise<ImportSummaryDto> {
    return this.importsService.importInvoices(file);
  }

  @Post('settlements')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Import settlement lines from a CSV file (rows are grouped into settlements by reference)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_BODY_SCHEMA })
  @ApiOkResponse({ description: 'Import processed', type: ImportSummaryDto })
  @ApiBadRequestResponse({ description: 'Invalid upload or missing required columns' })
  @ApiConflictResponse({ description: 'An identical import already exists' })
  importSettlements(@UploadedFile() file: Express.Multer.File): Promise<ImportSummaryDto> {
    return this.importsService.importSettlements(file);
  }
}

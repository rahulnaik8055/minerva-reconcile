import { ApiProperty } from '@nestjs/swagger';
import { importTypeEnum } from '../../../database/schema';

export class ImportErrorDto {
  @ApiProperty({ example: 7, description: 'Source row number in the CSV (header row is 1)' })
  row!: number;

  @ApiProperty({ example: 'amountCents: Unrecognized amount "(abc)"' })
  message!: string;
}

export class ImportSummaryDto {
  @ApiProperty({ example: 'acme-bank-july.csv' })
  filename!: string;

  @ApiProperty({ enum: importTypeEnum.enumValues })
  type!: (typeof importTypeEnum.enumValues)[number];

  @ApiProperty({ example: 14, description: 'Total data rows found in the file' })
  rowCount!: number;

  @ApiProperty({ example: 13, description: 'Rows imported successfully' })
  importedCount!: number;

  @ApiProperty({ example: 1, description: 'Rows rejected during validation' })
  rejectedCount!: number;

  @ApiProperty({ type: [ImportErrorDto] })
  errors!: ImportErrorDto[];
}

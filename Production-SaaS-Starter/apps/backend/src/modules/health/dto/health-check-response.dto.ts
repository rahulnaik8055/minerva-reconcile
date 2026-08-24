import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 'reconcile-api' })
  service!: string;

  @ApiProperty({ example: '0.1.0' })
  version!: string;
}

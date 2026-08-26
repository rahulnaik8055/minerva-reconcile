import { Injectable } from '@nestjs/common';
import { HealthCheckResponseDto } from './dto/health-check-response.dto';

@Injectable()
export class HealthService {
  check(): HealthCheckResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'matchbook-api',
      version: '0.1.0',
    };
  }
}

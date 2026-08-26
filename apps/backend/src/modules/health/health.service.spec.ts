import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a healthy status', () => {
    const result = service.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('matchbook-api');
    expect(typeof result.timestamp).toBe('string');
  });
});

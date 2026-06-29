import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return health status with database up', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const result = await service.check();
    expect(result.status).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.services.database).toBe('up');
  });

  it('should return degraded status when database is down', async () => {
    mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'));
    const result = await service.check();
    expect(result.services.database).toBe('down');
  });
});

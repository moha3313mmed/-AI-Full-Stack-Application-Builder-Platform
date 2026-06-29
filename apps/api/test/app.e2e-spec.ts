import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AgentsService } from '../src/modules/agents/agents.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('App (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockRejectedValue(new Error('No DB')),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
  };

  const mockAgentsService = {
    triggerWorkflow: jest.fn().mockResolvedValue({
      workflowId: 'wf_test',
      status: 'started',
      message: 'Test workflow started',
    }),
    getWorkflowStatus: jest.fn().mockResolvedValue({
      workflowId: 'wf_test',
      status: 'started',
      message: 'Test workflow in progress',
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(AgentsService)
      .useValue(mockAgentsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api', () => {
    it('should return welcome message', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect((res: { body: { data: { message: string; version: string }; meta: { timestamp: string } } }) => {
          expect(res.body.data.message).toBe('Welcome to AI Builder Platform API');
          expect(res.body.data.version).toBe('0.1.0');
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.timestamp).toBeDefined();
        });
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res: { body: { data: { status: string; timestamp: string; services: unknown } } }) => {
          expect(res.body.data.status).toBeDefined();
          expect(res.body.data.timestamp).toBeDefined();
          expect(res.body.data.services).toBeDefined();
        });
    });
  });

  describe('Auth endpoints', () => {
    it('POST /api/auth/register should validate input', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('POST /api/auth/login should validate input', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('Protected routes', () => {
    it('GET /api/projects should require auth', () => {
      return request(app.getHttpServer())
        .get('/api/projects')
        .expect(401);
    });

    it('GET /api/users/me should require auth', () => {
      return request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);
    });

    it('GET /api/conversations should require auth', () => {
      return request(app.getHttpServer())
        .get('/api/conversations')
        .expect(401);
    });
  });
});

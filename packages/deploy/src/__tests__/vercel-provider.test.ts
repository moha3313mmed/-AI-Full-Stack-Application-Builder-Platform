import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { VercelProvider } from '../providers/vercel-provider.js';
import {
  DeploymentConfig,
  DeploymentProvider,
  DeploymentStatus,
} from '../types/index.js';

describe('VercelProvider', () => {
  const validConfig: DeploymentConfig = {
    provider: DeploymentProvider.VERCEL,
    envVars: { NODE_ENV: 'production' },
    buildCommand: 'npm run build',
    outputDir: '.next',
    region: 'us-east-1',
    projectId: 'proj-123',
    commitHash: 'abc123',
  };

  let provider: VercelProvider;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new VercelProvider({ token: 'test-vercel-token' });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw if token is not provided', () => {
      expect(() => new VercelProvider(null as unknown as { token: string })).toThrow(
        'Vercel token not configured',
      );
    });

    it('should throw if token is empty string', () => {
      expect(() => new VercelProvider({ token: '' })).toThrow(
        'Vercel token not configured',
      );
    });

    it('should create provider with valid token', () => {
      const p = new VercelProvider({ token: 'valid-token' });
      expect(p).toBeDefined();
    });

    it('should accept optional teamId', () => {
      const p = new VercelProvider({ token: 'valid-token', teamId: 'team_123' });
      expect(p).toBeDefined();
    });
  });

  describe('deploy', () => {
    it('should call POST /v13/deployments with correct body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_abc123',
          url: 'proj-123-abc123.vercel.app',
          readyState: 'READY',
        })),
      });

      await provider.deploy(validConfig);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.vercel.com/v13/deployments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-vercel-token',
            'Content-Type': 'application/json',
          }),
        }),
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.name).toBe('proj-123');
      expect(body.projectSettings.buildCommand).toBe('npm run build');
      expect(body.projectSettings.outputDirectory).toBe('.next');
      expect(body.env.NODE_ENV).toBe('production');
      expect(body.gitMetadata.commitSha).toBe('abc123');
    });

    it('should return deployment result with correct fields', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_abc123',
          url: 'proj-123-abc123.vercel.app',
          readyState: 'READY',
        })),
      });

      const result = await provider.deploy(validConfig);

      expect(result.id).toBe('dpl_abc123');
      expect(result.url).toBe('https://proj-123-abc123.vercel.app');
      expect(result.status).toBe(DeploymentStatus.DEPLOYED);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.logs.length).toBeGreaterThan(0);
    });

    it('should use custom domain when provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_abc123',
          url: 'proj-123-abc123.vercel.app',
          readyState: 'READY',
        })),
      });

      const configWithDomain = { ...validConfig, customDomain: 'myapp.example.com' };
      const result = await provider.deploy(configWithDomain);

      expect(result.url).toBe('https://myapp.example.com');
    });

    it('should throw on API error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'Forbidden' },
        })),
      });

      await expect(provider.deploy(validConfig)).rejects.toThrow(
        'Vercel API error (403): Forbidden',
      );
    });

    it('should throw validation error for missing build command', async () => {
      const invalidConfig = { ...validConfig, buildCommand: '' };

      await expect(provider.deploy(invalidConfig)).rejects.toThrow(
        'Deployment validation failed',
      );
    });

    it('should throw validation error for missing output dir', async () => {
      const invalidConfig = { ...validConfig, outputDir: '' };

      await expect(provider.deploy(invalidConfig)).rejects.toThrow(
        'Deployment validation failed',
      );
    });

    it('should throw validation error for missing project ID', async () => {
      const invalidConfig = { ...validConfig, projectId: '' };

      await expect(provider.deploy(invalidConfig)).rejects.toThrow(
        'Deployment validation failed',
      );
    });

    it('should include teamId in query params when configured', async () => {
      const teamProvider = new VercelProvider({ token: 'test-token', teamId: 'team_123' });

      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_abc123',
          url: 'proj.vercel.app',
          readyState: 'READY',
        })),
      });

      await teamProvider.deploy(validConfig);

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('teamId=team_123');
    });

    it('should map BUILDING readyState correctly', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_abc123',
          url: 'proj.vercel.app',
          readyState: 'BUILDING',
        })),
      });

      const result = await provider.deploy(validConfig);
      expect(result.status).toBe(DeploymentStatus.BUILDING);
    });

    it('should map ERROR readyState to FAILED', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_abc123',
          url: 'proj.vercel.app',
          readyState: 'ERROR',
        })),
      });

      const result = await provider.deploy(validConfig);
      expect(result.status).toBe(DeploymentStatus.FAILED);
    });
  });

  describe('uploadFile', () => {
    it('should POST to /v2/files with SHA1 digest header', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(''),
      });

      const content = 'console.log("hello");';
      const sha = await provider.uploadFile(content);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.vercel.com/v2/files',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-vercel-token',
            'x-vercel-digest': sha,
          }),
        }),
      );
      // SHA1 is a 40 character hex string
      expect(sha).toMatch(/^[a-f0-9]{40}$/);
    });

    it('should handle Buffer content', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(''),
      });

      const buffer = Buffer.from('binary content');
      const sha = await provider.uploadFile(buffer);

      expect(sha).toMatch(/^[a-f0-9]{40}$/);
    });
  });

  describe('deployWithFiles', () => {
    it('should POST deployment with files array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_files123',
          url: 'proj-files.vercel.app',
          readyState: 'READY',
        })),
      });

      const files = [
        { file: 'index.html', sha: 'abc123', size: 100 },
        { file: 'style.css', sha: 'def456', size: 200 },
      ];

      const result = await provider.deployWithFiles(validConfig, files);

      expect(result.id).toBe('dpl_files123');
      expect(result.url).toBe('https://proj-files.vercel.app');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.files).toHaveLength(2);
      expect(body.files[0].file).toBe('index.html');
      expect(body.files[0].sha).toBe('abc123');
    });
  });

  describe('getStatus', () => {
    it('should GET /v13/deployments/:id and map state', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          readyState: 'READY',
        })),
      });

      const status = await provider.getStatus('dpl_abc123');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.vercel.com/v13/deployments/dpl_abc123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-vercel-token',
          }),
        }),
      );
      expect(status).toBe(DeploymentStatus.DEPLOYED);
    });

    it('should map INITIALIZING to BUILDING', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ readyState: 'INITIALIZING' })),
      });

      const status = await provider.getStatus('dpl_abc123');
      expect(status).toBe(DeploymentStatus.BUILDING);
    });

    it('should map ANALYZING to BUILDING', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ readyState: 'ANALYZING' })),
      });

      const status = await provider.getStatus('dpl_abc123');
      expect(status).toBe(DeploymentStatus.BUILDING);
    });

    it('should map DEPLOYING to DEPLOYING', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ readyState: 'DEPLOYING' })),
      });

      const status = await provider.getStatus('dpl_abc123');
      expect(status).toBe(DeploymentStatus.DEPLOYING);
    });

    it('should map CANCELED to FAILED', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ readyState: 'CANCELED' })),
      });

      const status = await provider.getStatus('dpl_abc123');
      expect(status).toBe(DeploymentStatus.FAILED);
    });

    it('should map unknown state to PENDING', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ readyState: 'QUEUED' })),
      });

      const status = await provider.getStatus('dpl_abc123');
      expect(status).toBe(DeploymentStatus.PENDING);
    });

    it('should throw on API error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'Deployment not found' },
        })),
      });

      await expect(provider.getStatus('dpl_invalid')).rejects.toThrow(
        'Vercel API error (404): Deployment not found',
      );
    });
  });

  describe('rollback', () => {
    it('should GET original deployment then POST a new one', async () => {
      // First call: GET original deployment
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_original',
          url: 'original.vercel.app',
          readyState: 'READY',
          name: 'my-project',
        })),
      });

      // Second call: POST new deployment
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          id: 'dpl_rollback',
          url: 'rollback.vercel.app',
          readyState: 'READY',
        })),
      });

      const result = await provider.rollback('dpl_original');

      expect(result.id).toBe('dpl_rollback');
      expect(result.url).toBe('https://rollback.vercel.app');
      expect(result.status).toBe(DeploymentStatus.ROLLED_BACK);
      expect(result.logs.some((l) => l.includes('Rollback initiated'))).toBe(true);

      // Verify first call was GET
      expect(fetchMock.mock.calls[0][1].method).toBe('GET');
      expect(fetchMock.mock.calls[0][0]).toContain('/v13/deployments/dpl_original');

      // Verify second call was POST with rollback metadata
      expect(fetchMock.mock.calls[1][1].method).toBe('POST');
      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.meta.rollbackFrom).toBe('dpl_original');
    });
  });

  describe('getLogs', () => {
    it('should GET /v2/deployments/:id/events and parse logs', async () => {
      const now = Date.now();
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([
          { type: 'command', created: now, payload: { text: 'npm run build' } },
          { type: 'stdout', created: now + 100, payload: { text: 'Build succeeded' } },
          { type: 'error', created: now + 200, payload: { text: 'Warning: unused var' } },
        ])),
      });

      const logs = await provider.getLogs('dpl_abc123');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.vercel.com/v2/deployments/dpl_abc123/events',
        expect.objectContaining({ method: 'GET' }),
      );

      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('npm run build');
      expect(logs[0].level).toBe('info');
      expect(logs[1].message).toBe('Build succeeded');
      expect(logs[1].level).toBe('info');
      expect(logs[2].message).toBe('Warning: unused var');
      expect(logs[2].level).toBe('error');
    });

    it('should handle empty events array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([])),
      });

      const logs = await provider.getLogs('dpl_abc123');
      expect(logs).toHaveLength(0);
    });
  });

  describe('validateConfig', () => {
    it('should return empty array for valid config', async () => {
      const errors = await provider.validateConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing build command', async () => {
      const errors = await provider.validateConfig({ ...validConfig, buildCommand: '' });
      expect(errors).toContain('Build command is required');
    });

    it('should return error for missing output dir', async () => {
      const errors = await provider.validateConfig({ ...validConfig, outputDir: '' });
      expect(errors).toContain('Output directory is required');
    });

    it('should return error for missing project ID', async () => {
      const errors = await provider.validateConfig({ ...validConfig, projectId: '' });
      expect(errors).toContain('Project ID is required');
    });

    it('should return error for invalid custom domain', async () => {
      const errors = await provider.validateConfig({ ...validConfig, customDomain: 'invalid domain!' });
      expect(errors).toContain('Invalid custom domain format');
    });

    it('should return multiple errors', async () => {
      const errors = await provider.validateConfig({
        ...validConfig,
        buildCommand: '',
        outputDir: '',
        projectId: '',
      });
      expect(errors).toHaveLength(3);
    });
  });
});

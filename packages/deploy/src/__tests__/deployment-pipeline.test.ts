import { describe, it, expect, beforeEach } from 'vitest';

import { DeploymentPipeline } from '../pipeline/deployment-pipeline.js';
import { BaseDeployProvider } from '../providers/base-provider.js';
import { NetlifyProvider } from '../providers/netlify-provider.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import {
  DeploymentConfig,
  DeploymentEvent,
  DeploymentProvider,
  DeploymentResult,
  DeploymentStatus,
} from '../types/index.js';

/**
 * A mock Vercel provider that simulates the behavior expected by tests
 * without making real API calls. This replaces the simulated VercelProvider
 * for test purposes since the real one requires a token and makes HTTP calls.
 */
class MockVercelProvider extends BaseDeployProvider {
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    const errors = await this.validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Deployment validation failed: ${errors.join(', ')}`);
    }

    const deploymentId = `dpl_${Date.now()}`;
    const now = new Date();

    return {
      id: deploymentId,
      url: config.customDomain
        ? `https://${config.customDomain}`
        : `https://${config.projectId}-${deploymentId.slice(0, 8)}.vercel.app`,
      status: DeploymentStatus.DEPLOYED,
      logs: [
        '[info] Deployment initiated on Vercel',
        `[info] Build command: ${config.buildCommand}`,
        `[info] Output directory: ${config.outputDir}`,
        '[info] Build completed successfully',
        '[info] Deployment complete',
      ],
      startedAt: now,
      completedAt: new Date(),
    };
  }

  async getStatus(_deploymentId: string): Promise<DeploymentStatus> {
    return DeploymentStatus.DEPLOYED;
  }

  async rollback(deploymentId: string): Promise<DeploymentResult> {
    return {
      id: `dpl_rollback_${Date.now()}`,
      url: `https://rollback.vercel.app`,
      status: DeploymentStatus.ROLLED_BACK,
      logs: [
        `[info] Rollback initiated for deployment ${deploymentId}`,
        '[info] Rollback completed successfully',
      ],
      startedAt: new Date(),
      completedAt: new Date(),
    };
  }

  async validateConfig(config: DeploymentConfig): Promise<string[]> {
    const errors: string[] = [];

    if (!config.buildCommand || config.buildCommand.trim() === '') {
      errors.push('Build command is required');
    }

    if (!config.outputDir || config.outputDir.trim() === '') {
      errors.push('Output directory is required');
    }

    if (!config.projectId || config.projectId.trim() === '') {
      errors.push('Project ID is required');
    }

    if (config.customDomain && !/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(config.customDomain)) {
      errors.push('Invalid custom domain format');
    }

    return errors;
  }

  async getLogs(_deploymentId: string): Promise<{ timestamp: Date; level: 'info' | 'warn' | 'error'; message: string }[]> {
    return [
      { timestamp: new Date(), level: 'info', message: 'Build started' },
      { timestamp: new Date(), level: 'info', message: 'Build completed' },
    ];
  }
}

describe('DeploymentPipeline', () => {
  let registry: ProviderRegistry;
  let pipeline: DeploymentPipeline;

  const validConfig: DeploymentConfig = {
    provider: DeploymentProvider.VERCEL,
    envVars: { NODE_ENV: 'production' },
    buildCommand: 'npm run build',
    outputDir: '.next',
    region: 'us-east-1',
    projectId: 'proj-123',
    commitHash: 'abc123',
  };

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register(DeploymentProvider.VERCEL, () => new MockVercelProvider());
    registry.register(DeploymentProvider.NETLIFY, () => new NetlifyProvider());
    pipeline = new DeploymentPipeline(registry);
  });

  it('should execute a successful deployment with Vercel', async () => {
    const result = await pipeline.execute(validConfig);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.url).toContain('.vercel.app');
    expect(result.status).toBe(DeploymentStatus.DEPLOYED);
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it('should execute a successful deployment with Netlify', async () => {
    const netlifyConfig: DeploymentConfig = {
      ...validConfig,
      provider: DeploymentProvider.NETLIFY,
    };

    const result = await pipeline.execute(netlifyConfig);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.url).toContain('.netlify.app');
    expect(result.status).toBe(DeploymentStatus.DEPLOYED);
  });

  it('should fail validation with missing build command', async () => {
    const invalidConfig: DeploymentConfig = {
      ...validConfig,
      buildCommand: '',
    };

    await expect(pipeline.execute(invalidConfig)).rejects.toThrow(
      'Deployment validation failed',
    );
  });

  it('should fail validation with missing output directory', async () => {
    const invalidConfig: DeploymentConfig = {
      ...validConfig,
      outputDir: '',
    };

    await expect(pipeline.execute(invalidConfig)).rejects.toThrow(
      'Deployment validation failed',
    );
  });

  it('should fail validation with missing project ID', async () => {
    const invalidConfig: DeploymentConfig = {
      ...validConfig,
      projectId: '',
    };

    await expect(pipeline.execute(invalidConfig)).rejects.toThrow(
      'Deployment validation failed',
    );
  });

  it('should emit events during the deployment lifecycle', async () => {
    const events: DeploymentEvent[] = [];
    pipeline.onEvent((event) => events.push(event));

    await pipeline.execute(validConfig);

    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0].data.currentStatus).toBe(DeploymentStatus.PENDING);
    expect(events[1].data.currentStatus).toBe(DeploymentStatus.BUILDING);
    expect(events[2].data.currentStatus).toBe(DeploymentStatus.DEPLOYING);
  });

  it('should emit status_change events with correct types', async () => {
    const events: DeploymentEvent[] = [];
    pipeline.onEvent((event) => events.push(event));

    await pipeline.execute(validConfig);

    const statusChanges = events.filter((e) => e.type === 'status_change');
    expect(statusChanges.length).toBeGreaterThanOrEqual(3);
    expect(statusChanges[0].type).toBe('status_change');
  });

  it('should use custom domain in deployment URL when provided', async () => {
    const configWithDomain: DeploymentConfig = {
      ...validConfig,
      customDomain: 'myapp.example.com',
    };

    const result = await pipeline.execute(configWithDomain);

    expect(result.url).toBe('https://myapp.example.com');
  });

  it('should throw when using an unregistered provider', async () => {
    const invalidConfig: DeploymentConfig = {
      ...validConfig,
      provider: DeploymentProvider.AWS,
    };

    await expect(pipeline.execute(invalidConfig)).rejects.toThrow(
      'Provider "AWS" is not registered',
    );
  });

  it('should include logs in the deployment result', async () => {
    const result = await pipeline.execute(validConfig);

    expect(result.logs).toBeDefined();
    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.some((log) => log.includes('Build'))).toBe(true);
  });

  it('should execute with rollback and return successfully', async () => {
    const result = await pipeline.executeWithRollback(validConfig);

    expect(result).toBeDefined();
    expect(result.status).toBe(DeploymentStatus.DEPLOYED);
  });

  it('should emit error event on deployment failure', async () => {
    const events: DeploymentEvent[] = [];
    pipeline.onEvent((event) => events.push(event));

    const invalidConfig: DeploymentConfig = {
      ...validConfig,
      buildCommand: '',
    };

    await expect(pipeline.execute(invalidConfig)).rejects.toThrow();

    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].data.error).toContain('Build command is required');
  });

  it('should support multiple event handlers', async () => {
    const handler1Events: DeploymentEvent[] = [];
    const handler2Events: DeploymentEvent[] = [];

    pipeline.onEvent((event) => handler1Events.push(event));
    pipeline.onEvent((event) => handler2Events.push(event));

    await pipeline.execute(validConfig);

    expect(handler1Events.length).toBe(handler2Events.length);
    expect(handler1Events.length).toBeGreaterThan(0);
  });

  it('should work with auto-rollback disabled', async () => {
    const pipelineNoRollback = new DeploymentPipeline(registry, { autoRollback: false });
    const result = await pipelineNoRollback.execute(validConfig);

    expect(result.status).toBe(DeploymentStatus.DEPLOYED);
  });

  it('should validate config with invalid custom domain', async () => {
    const invalidConfig: DeploymentConfig = {
      ...validConfig,
      customDomain: 'not a valid domain!',
    };

    await expect(pipeline.execute(invalidConfig)).rejects.toThrow(
      'Deployment validation failed',
    );
  });

  it('should handle deployment with all optional fields', async () => {
    const minimalConfig: DeploymentConfig = {
      provider: DeploymentProvider.VERCEL,
      envVars: {},
      buildCommand: 'npm run build',
      outputDir: 'dist',
      projectId: 'proj-456',
    };

    const result = await pipeline.execute(minimalConfig);

    expect(result).toBeDefined();
    expect(result.status).toBe(DeploymentStatus.DEPLOYED);
  });
});

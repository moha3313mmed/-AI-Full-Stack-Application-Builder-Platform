import { createHash } from 'crypto';

import {
  DeploymentConfig,
  DeploymentLogEntry,
  DeploymentResult,
  DeploymentStatus,
} from '../types/index.js';

import { BaseDeployProvider } from './base-provider.js';

/**
 * Configuration for the Vercel deployment provider.
 */
export interface VercelProviderConfig {
  /** Vercel API token for authentication. */
  token: string;
  /** Optional Vercel team ID for team deployments. */
  teamId?: string;
}

/**
 * File descriptor for Vercel file-upload deployments.
 */
interface VercelFileDescriptor {
  file: string;
  sha: string;
  size: number;
}

/**
 * Maps Vercel deployment states to our internal DeploymentStatus enum.
 */
function mapVercelState(state: string): DeploymentStatus {
  switch (state) {
    case 'INITIALIZING':
    case 'ANALYZING':
    case 'BUILDING':
      return DeploymentStatus.BUILDING;
    case 'DEPLOYING':
      return DeploymentStatus.DEPLOYING;
    case 'READY':
      return DeploymentStatus.DEPLOYED;
    case 'ERROR':
    case 'CANCELED':
      return DeploymentStatus.FAILED;
    default:
      return DeploymentStatus.PENDING;
  }
}

/**
 * Vercel deployment provider using the Vercel REST API.
 * Supports file-upload deployments, status checking, log retrieval, and rollback.
 */
export class VercelProvider extends BaseDeployProvider {
  private readonly config: VercelProviderConfig;
  private readonly baseUrl = 'https://api.vercel.com';

  constructor(config: VercelProviderConfig) {
    super();
    if (!config || !config.token) {
      throw new Error('Vercel token not configured');
    }
    this.config = config;
  }

  /**
   * Deploy the project to Vercel using the file-upload deployment API.
   * When config.files is provided, uploads each file and creates a deployment
   * with the file descriptors. Otherwise falls back to project-settings-only
   * deployment (e.g., when using a git source).
   */
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    const errors = await this.validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Deployment validation failed: ${errors.join(', ')}`);
    }

    const startedAt = new Date();

    // If files are provided in config, upload them and create a file-based deployment
    if (config.files && config.files.length > 0) {
      const fileDescriptors: VercelFileDescriptor[] = [];

      for (const file of config.files) {
        const sha = await this.uploadFile(file.content);
        const size = Buffer.byteLength(file.content, 'utf-8');
        // Strip leading slash for Vercel file paths
        const filePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        fileDescriptors.push({ file: filePath, sha, size });
      }

      return this.deployWithFiles(config, fileDescriptors);
    }

    // Fallback: deploy with project settings only (git-linked projects)
    const response = await this.request<{
      id: string;
      url: string;
      readyState: string;
      alias?: string[];
    }>('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify({
        name: config.projectId,
        target: 'production',
        projectSettings: {
          buildCommand: config.buildCommand,
          outputDirectory: config.outputDir,
          framework: null,
        },
        env: config.envVars,
        ...(config.commitHash && {
          gitMetadata: { commitSha: config.commitHash },
        }),
      }),
    });

    const deploymentUrl = config.customDomain
      ? `https://${config.customDomain}`
      : `https://${response.url}`;

    const result: DeploymentResult = {
      id: response.id,
      url: deploymentUrl,
      status: mapVercelState(response.readyState),
      logs: [
        `[info] Deployment created: ${response.id}`,
        `[info] Build command: ${config.buildCommand}`,
        `[info] Output directory: ${config.outputDir}`,
        `[info] URL: ${deploymentUrl}`,
      ],
      startedAt,
      completedAt: new Date(),
    };

    return result;
  }

  /**
   * Upload a single file to Vercel's file storage.
   * Used for file-upload deployments.
   */
  async uploadFile(content: Buffer | string): Promise<string> {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    const sha = createHash('sha1').update(buffer).digest('hex');

    await this.request('/v2/files', {
      method: 'POST',
      headers: {
        'x-vercel-digest': sha,
        'Content-Length': String(buffer.length),
      },
      body: buffer,
      rawBody: true,
    });

    return sha;
  }

  /**
   * Deploy with pre-uploaded files using the file-upload deployment approach.
   */
  async deployWithFiles(
    config: DeploymentConfig,
    files: VercelFileDescriptor[],
  ): Promise<DeploymentResult> {
    const errors = await this.validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Deployment validation failed: ${errors.join(', ')}`);
    }

    const startedAt = new Date();

    const response = await this.request<{
      id: string;
      url: string;
      readyState: string;
    }>('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify({
        name: config.projectId,
        files: files.map((f) => ({
          file: f.file,
          sha: f.sha,
          size: f.size,
        })),
        target: 'production',
        projectSettings: {
          buildCommand: config.buildCommand,
          outputDirectory: config.outputDir,
        },
        env: config.envVars,
        ...(config.commitHash && {
          gitMetadata: { commitSha: config.commitHash },
        }),
      }),
    });

    const deploymentUrl = config.customDomain
      ? `https://${config.customDomain}`
      : `https://${response.url}`;

    return {
      id: response.id,
      url: deploymentUrl,
      status: mapVercelState(response.readyState),
      logs: [
        `[info] Deployment created with ${files.length} files`,
        `[info] Deployment ID: ${response.id}`,
        `[info] URL: ${deploymentUrl}`,
      ],
      startedAt,
      completedAt: new Date(),
    };
  }

  /**
   * Get the current status of a deployment by its ID.
   */
  async getStatus(deploymentId: string): Promise<DeploymentStatus> {
    const response = await this.request<{ readyState: string }>(
      `/v13/deployments/${deploymentId}`,
      { method: 'GET' },
    );

    return mapVercelState(response.readyState);
  }

  /**
   * Rollback by creating a new deployment that redeploys a previous deployment.
   * Uses the Vercel revert/rollback mechanism.
   */
  async rollback(deploymentId: string): Promise<DeploymentResult> {
    // Get the original deployment to retrieve its files/config
    const original = await this.request<{
      id: string;
      url: string;
      readyState: string;
      name: string;
      meta?: Record<string, string>;
    }>(`/v13/deployments/${deploymentId}`, { method: 'GET' });

    // Create a new deployment pointing to the same project
    // This effectively rolls back by redeploying the same configuration
    const response = await this.request<{
      id: string;
      url: string;
      readyState: string;
    }>('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify({
        name: original.name,
        deploymentId: deploymentId,
        target: 'production',
        meta: {
          rollbackFrom: deploymentId,
        },
      }),
    });

    return {
      id: response.id,
      url: `https://${response.url}`,
      status: DeploymentStatus.ROLLED_BACK,
      logs: [
        `[info] Rollback initiated from deployment ${deploymentId}`,
        `[info] New deployment created: ${response.id}`,
        `[info] URL: https://${response.url}`,
      ],
      startedAt: new Date(),
      completedAt: new Date(),
    };
  }

  /**
   * Validate a deployment configuration before deploying.
   */
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

    if (
      config.customDomain &&
      !/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(config.customDomain)
    ) {
      errors.push('Invalid custom domain format');
    }

    return errors;
  }

  /**
   * Get deployment build logs from Vercel.
   */
  async getLogs(deploymentId: string): Promise<DeploymentLogEntry[]> {
    const response = await this.request<
      Array<{
        type: string;
        created: number;
        payload?: { text?: string; statusCode?: number };
        text?: string;
      }>
    >(`/v2/deployments/${deploymentId}/events`, { method: 'GET' });

    // The events endpoint returns an array of log event objects
    const events = Array.isArray(response) ? response : [];

    return events.map((event) => ({
      timestamp: new Date(event.created),
      level: event.type === 'error' ? 'error' : event.type === 'warning' ? 'warn' : 'info',
      message: event.payload?.text || event.text || `[${event.type}]`,
    }));
  }

  /**
   * Make an authenticated request to the Vercel API.
   */
  private async request<T>(
    path: string,
    options: {
      method: string;
      body?: string | Buffer;
      headers?: Record<string, string>;
      rawBody?: boolean;
    },
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    // Add teamId query parameter if configured
    if (this.config.teamId) {
      url.searchParams.set('teamId', this.config.teamId);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.token}`,
      ...options.headers,
    };

    // Add Content-Type for JSON bodies (not raw file uploads)
    if (!options.rawBody && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    // Convert Buffer to Uint8Array for fetch compatibility
    const fetchBody = options.body instanceof Buffer
      ? new Uint8Array(options.body)
      : options.body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await fetch(url.toString(), {
      method: options.method,
      headers,
      body: fetchBody as any,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.message || errorBody;
      } catch {
        errorMessage = errorBody;
      }
      throw new Error(
        `Vercel API error (${response.status}): ${errorMessage}`,
      );
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }
}

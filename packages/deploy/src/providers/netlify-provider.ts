import { generateId } from '@builder/shared';

import {
  DeploymentConfig,
  DeploymentLogEntry,
  DeploymentResult,
  DeploymentStatus,
} from '../types/index.js';

import { BaseDeployProvider } from './base-provider.js';

/**
 * Netlify deployment provider adapter.
 * Simulates the Netlify deployment API with proper status transitions.
 */
export class NetlifyProvider extends BaseDeployProvider {
  private deployments: Map<string, DeploymentResult> = new Map();
  private deploymentLogs: Map<string, DeploymentLogEntry[]> = new Map();

  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    const errors = await this.validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Deployment validation failed: ${errors.join(', ')}`);
    }

    const deploymentId = generateId();
    const now = new Date();

    const logs: DeploymentLogEntry[] = [
      { timestamp: now, level: 'info', message: 'Deployment initiated on Netlify' },
      { timestamp: now, level: 'info', message: `Build command: ${config.buildCommand}` },
      { timestamp: now, level: 'info', message: `Publish directory: ${config.outputDir}` },
    ];

    if (config.region) {
      logs.push({ timestamp: now, level: 'info', message: `Deploy region: ${config.region}` });
    }

    // Simulate successful deployment
    logs.push(
      { timestamp: now, level: 'info', message: 'Installing dependencies...' },
      { timestamp: now, level: 'info', message: 'Running build command...' },
      { timestamp: now, level: 'info', message: 'Build completed' },
      { timestamp: now, level: 'info', message: 'Deploying to Netlify CDN...' },
      { timestamp: now, level: 'info', message: 'Deploy complete' },
    );

    const result: DeploymentResult = {
      id: deploymentId,
      url: config.customDomain
        ? `https://${config.customDomain}`
        : `https://${config.projectId}-${deploymentId.slice(0, 8)}.netlify.app`,
      status: DeploymentStatus.DEPLOYED,
      logs: logs.map((l) => `[${l.level}] ${l.message}`),
      startedAt: now,
      completedAt: new Date(),
    };

    this.deployments.set(deploymentId, result);
    this.deploymentLogs.set(deploymentId, logs);

    return result;
  }

  async getStatus(deploymentId: string): Promise<DeploymentStatus> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment "${deploymentId}" not found`);
    }
    return deployment.status;
  }

  async rollback(deploymentId: string): Promise<DeploymentResult> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment "${deploymentId}" not found`);
    }

    const now = new Date();
    const rolledBack: DeploymentResult = {
      ...deployment,
      status: DeploymentStatus.ROLLED_BACK,
      completedAt: now,
      logs: [
        ...deployment.logs,
        `[info] Rollback initiated for deployment ${deploymentId}`,
        '[info] Previous deploy restored on Netlify',
        '[info] Rollback completed successfully',
      ],
    };

    this.deployments.set(deploymentId, rolledBack);
    this.deploymentLogs.get(deploymentId)?.push(
      { timestamp: now, level: 'info', message: `Rollback initiated for deployment ${deploymentId}` },
      { timestamp: now, level: 'info', message: 'Previous deploy restored on Netlify' },
      { timestamp: now, level: 'info', message: 'Rollback completed successfully' },
    );

    return rolledBack;
  }

  async validateConfig(config: DeploymentConfig): Promise<string[]> {
    const errors: string[] = [];

    if (!config.buildCommand || config.buildCommand.trim() === '') {
      errors.push('Build command is required');
    }

    if (!config.outputDir || config.outputDir.trim() === '') {
      errors.push('Output directory (publish directory) is required');
    }

    if (!config.projectId || config.projectId.trim() === '') {
      errors.push('Project ID is required');
    }

    if (config.customDomain && !/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(config.customDomain)) {
      errors.push('Invalid custom domain format');
    }

    return errors;
  }

  async getLogs(deploymentId: string): Promise<DeploymentLogEntry[]> {
    const logs = this.deploymentLogs.get(deploymentId);
    if (!logs) {
      throw new Error(`Deployment "${deploymentId}" not found`);
    }
    return logs;
  }
}

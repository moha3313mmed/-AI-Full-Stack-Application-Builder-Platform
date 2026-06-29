import { BaseDeployProvider } from '../providers/base-provider.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import {
  DeploymentConfig,
  DeploymentEvent,
  DeploymentResult,
  DeploymentStatus,
} from '../types/index.js';

export type PipelineEventHandler = (event: DeploymentEvent) => void;

/**
 * DeploymentPipeline orchestrates the full deployment lifecycle:
 * validate config -> build -> deploy -> verify -> update status.
 * Supports automatic rollback on failure and emits events for each stage transition.
 */
export class DeploymentPipeline {
  private eventHandlers: PipelineEventHandler[] = [];
  private registry: ProviderRegistry;
  private autoRollback: boolean;

  constructor(registry: ProviderRegistry, options?: { autoRollback?: boolean }) {
    this.registry = registry;
    this.autoRollback = options?.autoRollback ?? true;
  }

  /**
   * Register an event handler for pipeline events.
   */
  onEvent(handler: PipelineEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Execute the full deployment pipeline.
   */
  async execute(config: DeploymentConfig): Promise<DeploymentResult> {
    const provider = this.registry.get(config.provider);

    // Stage 1: Validate configuration
    this.emitEvent({
      type: 'status_change',
      deploymentId: '',
      timestamp: new Date(),
      data: { currentStatus: DeploymentStatus.PENDING, message: 'Validating deployment configuration' },
    });

    const errors = await provider.validateConfig(config);
    if (errors.length > 0) {
      this.emitEvent({
        type: 'error',
        deploymentId: '',
        timestamp: new Date(),
        data: { currentStatus: DeploymentStatus.FAILED, error: errors.join(', ') },
      });
      throw new Error(`Deployment validation failed: ${errors.join(', ')}`);
    }

    // Stage 2: Build
    this.emitEvent({
      type: 'status_change',
      deploymentId: '',
      timestamp: new Date(),
      data: {
        previousStatus: DeploymentStatus.PENDING,
        currentStatus: DeploymentStatus.BUILDING,
        message: 'Building project',
      },
    });

    // Stage 3: Deploy
    this.emitEvent({
      type: 'status_change',
      deploymentId: '',
      timestamp: new Date(),
      data: {
        previousStatus: DeploymentStatus.BUILDING,
        currentStatus: DeploymentStatus.DEPLOYING,
        message: 'Deploying to provider',
      },
    });

    let result: DeploymentResult;
    try {
      result = await provider.deploy(config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';

      this.emitEvent({
        type: 'error',
        deploymentId: '',
        timestamp: new Date(),
        data: { currentStatus: DeploymentStatus.FAILED, error: errorMessage },
      });

      throw new Error(`Deployment failed: ${errorMessage}`);
    }

    // Stage 4: Verify
    this.emitEvent({
      type: 'status_change',
      deploymentId: result.id,
      timestamp: new Date(),
      data: {
        previousStatus: DeploymentStatus.DEPLOYING,
        currentStatus: result.status,
        message: 'Deployment completed',
      },
    });

    return result;
  }

  /**
   * Execute deployment with automatic rollback on failure.
   * If the deployment fails and autoRollback is enabled,
   * attempts to roll back to the previous state.
   */
  async executeWithRollback(
    config: DeploymentConfig,
    previousDeploymentId?: string,
  ): Promise<DeploymentResult> {
    try {
      return await this.execute(config);
    } catch (error) {
      if (this.autoRollback && previousDeploymentId) {
        const provider = this.getProvider(config);
        return this.rollback(provider, previousDeploymentId);
      }
      throw error;
    }
  }

  /**
   * Rollback a deployment using the provider.
   */
  async rollback(provider: BaseDeployProvider, deploymentId: string): Promise<DeploymentResult> {
    this.emitEvent({
      type: 'status_change',
      deploymentId,
      timestamp: new Date(),
      data: { currentStatus: DeploymentStatus.ROLLED_BACK, message: 'Rolling back deployment' },
    });

    return provider.rollback(deploymentId);
  }

  private getProvider(config: DeploymentConfig): BaseDeployProvider {
    return this.registry.get(config.provider);
  }

  private emitEvent(event: DeploymentEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }
}

import {
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatus,
  DeploymentLogEntry,
  ProviderCredentials,
} from '../types/index.js';

/**
 * Abstract base class for deployment provider adapters.
 * Each concrete provider (Vercel, Netlify, etc.) must implement these methods.
 */
export abstract class BaseDeployProvider {
  protected credentials: ProviderCredentials | null = null;

  /**
   * Set provider credentials for authenticated operations.
   */
  setCredentials(credentials: ProviderCredentials): void {
    this.credentials = credentials;
  }

  /**
   * Deploy the project with the given configuration.
   * Returns a DeploymentResult with the initial deployment state.
   */
  abstract deploy(config: DeploymentConfig): Promise<DeploymentResult>;

  /**
   * Get the current status of a deployment by its ID.
   */
  abstract getStatus(deploymentId: string): Promise<DeploymentStatus>;

  /**
   * Roll back a deployment to a previous version.
   * Returns the new deployment result after rollback.
   */
  abstract rollback(deploymentId: string): Promise<DeploymentResult>;

  /**
   * Validate a deployment configuration before deploying.
   * Returns an array of validation errors (empty if valid).
   */
  abstract validateConfig(config: DeploymentConfig): Promise<string[]>;

  /**
   * Get the logs for a specific deployment.
   */
  abstract getLogs(deploymentId: string): Promise<DeploymentLogEntry[]>;
}

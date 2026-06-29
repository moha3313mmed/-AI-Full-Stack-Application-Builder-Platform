import { ProjectFramework } from '@builder/shared';

// ============================================================================
// Types
// ============================================================================

export interface BuildConfiguration {
  buildCommand: string;
  outputDir: string;
  nodeVersion: string;
  installCommand: string;
  devCommand: string;
  framework: ProjectFramework;
}

// ============================================================================
// Build Config Resolver
// ============================================================================

/**
 * BuildConfigResolver resolves build configuration based on project framework.
 * Maps ProjectFramework enum to default build commands, output dirs, and Node versions.
 */
export class BuildConfigResolver {
  private frameworkConfigs: Map<ProjectFramework, BuildConfiguration>;

  constructor() {
    this.frameworkConfigs = new Map();
    this.initializeDefaults();
  }

  /**
   * Resolve build configuration for a given framework.
   * Returns default config if framework is not explicitly configured.
   */
  resolve(framework: ProjectFramework): BuildConfiguration {
    const config = this.frameworkConfigs.get(framework);
    if (config) {
      return { ...config };
    }
    return this.getDefaultConfig(framework);
  }

  /**
   * Override the default configuration for a framework.
   */
  setConfig(framework: ProjectFramework, config: Partial<BuildConfiguration>): void {
    const existing = this.frameworkConfigs.get(framework) || this.getDefaultConfig(framework);
    this.frameworkConfigs.set(framework, { ...existing, ...config, framework });
  }

  /**
   * Get all supported frameworks.
   */
  getSupportedFrameworks(): ProjectFramework[] {
    return Array.from(this.frameworkConfigs.keys());
  }

  /**
   * Check if a framework has explicit configuration.
   */
  hasConfig(framework: ProjectFramework): boolean {
    return this.frameworkConfigs.has(framework);
  }

  private initializeDefaults(): void {
    this.frameworkConfigs.set(ProjectFramework.NEXTJS, {
      buildCommand: 'next build',
      outputDir: '.next',
      nodeVersion: '20',
      installCommand: 'npm install',
      devCommand: 'next dev',
      framework: ProjectFramework.NEXTJS,
    });

    this.frameworkConfigs.set(ProjectFramework.REACT, {
      buildCommand: 'react-scripts build',
      outputDir: 'build',
      nodeVersion: '20',
      installCommand: 'npm install',
      devCommand: 'react-scripts start',
      framework: ProjectFramework.REACT,
    });

    this.frameworkConfigs.set(ProjectFramework.VUE, {
      buildCommand: 'vue-cli-service build',
      outputDir: 'dist',
      nodeVersion: '20',
      installCommand: 'npm install',
      devCommand: 'vue-cli-service serve',
      framework: ProjectFramework.VUE,
    });

    this.frameworkConfigs.set(ProjectFramework.SVELTE, {
      buildCommand: 'vite build',
      outputDir: 'dist',
      nodeVersion: '20',
      installCommand: 'npm install',
      devCommand: 'vite dev',
      framework: ProjectFramework.SVELTE,
    });

    this.frameworkConfigs.set(ProjectFramework.EXPRESS, {
      buildCommand: 'tsc',
      outputDir: 'dist',
      nodeVersion: '20',
      installCommand: 'npm install',
      devCommand: 'ts-node src/index.ts',
      framework: ProjectFramework.EXPRESS,
    });

    this.frameworkConfigs.set(ProjectFramework.NESTJS, {
      buildCommand: 'nest build',
      outputDir: 'dist',
      nodeVersion: '20',
      installCommand: 'npm install',
      devCommand: 'nest start --watch',
      framework: ProjectFramework.NESTJS,
    });
  }

  private getDefaultConfig(framework: ProjectFramework): BuildConfiguration {
    return {
      buildCommand: 'npm run build',
      outputDir: 'dist',
      nodeVersion: '20',
      installCommand: 'npm install',
      devCommand: 'npm run dev',
      framework,
    };
  }
}

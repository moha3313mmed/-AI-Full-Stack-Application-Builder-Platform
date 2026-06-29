// @builder/git - Branch Strategy

import { BranchStrategyType } from '../types/index.js';

export interface BranchStrategyConfig {
  type: BranchStrategyType;
  mainBranch?: string;
  developBranch?: string;
  featurePrefix?: string;
  releasePrefix?: string;
  hotfixPrefix?: string;
}

/**
 * BranchStrategy implements common branching strategies.
 * Supports GitFlow, GitHub Flow, and Trunk-based development.
 */
export class BranchStrategy {
  private config: Required<BranchStrategyConfig>;

  constructor(config: BranchStrategyConfig) {
    this.config = {
      type: config.type,
      mainBranch: config.mainBranch || 'main',
      developBranch: config.developBranch || 'develop',
      featurePrefix: config.featurePrefix || 'feature/',
      releasePrefix: config.releasePrefix || 'release/',
      hotfixPrefix: config.hotfixPrefix || 'hotfix/',
    };
  }

  /**
   * Get the default branch for this strategy.
   */
  getDefaultBranch(): string {
    switch (this.config.type) {
      case BranchStrategyType.GITFLOW:
        return this.config.developBranch;
      case BranchStrategyType.GITHUB_FLOW:
      case BranchStrategyType.TRUNK_BASED:
        return this.config.mainBranch;
      default:
        return this.config.mainBranch;
    }
  }

  /**
   * Get the production/release branch.
   */
  getProductionBranch(): string {
    return this.config.mainBranch;
  }

  /**
   * Generate a feature branch name for a given feature description.
   */
  getFeatureBranchName(feature: string): string {
    const slug = this.slugify(feature);

    switch (this.config.type) {
      case BranchStrategyType.GITFLOW:
        return `${this.config.featurePrefix}${slug}`;
      case BranchStrategyType.GITHUB_FLOW:
        return `${this.config.featurePrefix}${slug}`;
      case BranchStrategyType.TRUNK_BASED:
        return `${slug}`;
      default:
        return `${this.config.featurePrefix}${slug}`;
    }
  }

  /**
   * Generate a release branch name for a given version.
   */
  getReleaseBranchName(version: string): string {
    switch (this.config.type) {
      case BranchStrategyType.GITFLOW:
        return `${this.config.releasePrefix}${version}`;
      case BranchStrategyType.GITHUB_FLOW:
        // GitHub Flow uses tags for releases, not branches
        return `${this.config.releasePrefix}${version}`;
      case BranchStrategyType.TRUNK_BASED:
        return `${this.config.releasePrefix}${version}`;
      default:
        return `${this.config.releasePrefix}${version}`;
    }
  }

  /**
   * Generate a hotfix branch name.
   */
  getHotfixBranchName(issue: string): string {
    const slug = this.slugify(issue);
    return `${this.config.hotfixPrefix}${slug}`;
  }

  /**
   * Determine if a branch should auto-merge into the target.
   * Returns true for low-risk merges based on the branching strategy.
   */
  shouldAutoMerge(source: string, target: string): boolean {
    switch (this.config.type) {
      case BranchStrategyType.GITFLOW:
        // In GitFlow, auto-merge from develop to release branches
        if (source === this.config.developBranch && target.startsWith(this.config.releasePrefix)) {
          return true;
        }
        // Auto-merge hotfixes into main and develop
        if (source.startsWith(this.config.hotfixPrefix)) {
          return target === this.config.mainBranch || target === this.config.developBranch;
        }
        return false;

      case BranchStrategyType.GITHUB_FLOW:
        // In GitHub Flow, feature branches merge into main via PR
        // Auto-merge only if source is a feature branch and target is main
        return source.startsWith(this.config.featurePrefix) && target === this.config.mainBranch;

      case BranchStrategyType.TRUNK_BASED:
        // In Trunk-based, short-lived branches always merge back to main
        return target === this.config.mainBranch;

      default:
        return false;
    }
  }

  /**
   * Get the source branch for creating a new feature branch.
   */
  getFeatureSourceBranch(): string {
    switch (this.config.type) {
      case BranchStrategyType.GITFLOW:
        return this.config.developBranch;
      case BranchStrategyType.GITHUB_FLOW:
      case BranchStrategyType.TRUNK_BASED:
        return this.config.mainBranch;
      default:
        return this.config.mainBranch;
    }
  }

  /**
   * Get the target branch for merging a feature.
   */
  getFeatureTargetBranch(): string {
    switch (this.config.type) {
      case BranchStrategyType.GITFLOW:
        return this.config.developBranch;
      case BranchStrategyType.GITHUB_FLOW:
      case BranchStrategyType.TRUNK_BASED:
        return this.config.mainBranch;
      default:
        return this.config.mainBranch;
    }
  }

  /**
   * Check if a branch name follows the strategy's naming convention.
   */
  isValidBranchName(name: string): boolean {
    if (name === this.config.mainBranch) return true;
    if (name === this.config.developBranch && this.config.type === BranchStrategyType.GITFLOW) {
      return true;
    }

    const validPrefixes = [
      this.config.featurePrefix,
      this.config.releasePrefix,
      this.config.hotfixPrefix,
    ];

    return validPrefixes.some((prefix) => name.startsWith(prefix));
  }

  /**
   * Get the current strategy type.
   */
  getStrategyType(): BranchStrategyType {
    return this.config.type;
  }

  /**
   * Get protected branches for this strategy.
   */
  getProtectedBranches(): string[] {
    switch (this.config.type) {
      case BranchStrategyType.GITFLOW:
        return [this.config.mainBranch, this.config.developBranch];
      case BranchStrategyType.GITHUB_FLOW:
      case BranchStrategyType.TRUNK_BASED:
        return [this.config.mainBranch];
      default:
        return [this.config.mainBranch];
    }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

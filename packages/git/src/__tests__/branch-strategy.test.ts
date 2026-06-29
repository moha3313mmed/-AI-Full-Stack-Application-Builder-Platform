import { describe, it, expect } from 'vitest';

import { BranchStrategy, BranchStrategyType } from '../index.js';

describe('BranchStrategy', () => {
  describe('GitFlow strategy', () => {
    const strategy = new BranchStrategy({ type: BranchStrategyType.GITFLOW });

    it('should use develop as default branch', () => {
      expect(strategy.getDefaultBranch()).toBe('develop');
    });

    it('should use main as production branch', () => {
      expect(strategy.getProductionBranch()).toBe('main');
    });

    it('should generate feature branch names with prefix', () => {
      const name = strategy.getFeatureBranchName('user authentication');

      expect(name).toBe('feature/user-authentication');
    });

    it('should generate release branch names', () => {
      const name = strategy.getReleaseBranchName('1.2.0');

      expect(name).toBe('release/1.2.0');
    });

    it('should generate hotfix branch names', () => {
      const name = strategy.getHotfixBranchName('critical bug fix');

      expect(name).toBe('hotfix/critical-bug-fix');
    });

    it('should auto-merge hotfixes into main', () => {
      expect(strategy.shouldAutoMerge('hotfix/fix-1', 'main')).toBe(true);
      expect(strategy.shouldAutoMerge('hotfix/fix-1', 'develop')).toBe(true);
    });

    it('should not auto-merge features into main', () => {
      expect(strategy.shouldAutoMerge('feature/test', 'main')).toBe(false);
    });

    it('should use develop as feature source branch', () => {
      expect(strategy.getFeatureSourceBranch()).toBe('develop');
    });

    it('should use develop as feature target branch', () => {
      expect(strategy.getFeatureTargetBranch()).toBe('develop');
    });

    it('should protect main and develop branches', () => {
      const protectedBranches = strategy.getProtectedBranches();

      expect(protectedBranches).toContain('main');
      expect(protectedBranches).toContain('develop');
    });

    it('should validate branch names', () => {
      expect(strategy.isValidBranchName('main')).toBe(true);
      expect(strategy.isValidBranchName('develop')).toBe(true);
      expect(strategy.isValidBranchName('feature/test')).toBe(true);
      expect(strategy.isValidBranchName('release/1.0.0')).toBe(true);
      expect(strategy.isValidBranchName('random-branch')).toBe(false);
    });
  });

  describe('GitHub Flow strategy', () => {
    const strategy = new BranchStrategy({ type: BranchStrategyType.GITHUB_FLOW });

    it('should use main as default branch', () => {
      expect(strategy.getDefaultBranch()).toBe('main');
    });

    it('should generate feature branch names', () => {
      const name = strategy.getFeatureBranchName('add login page');

      expect(name).toBe('feature/add-login-page');
    });

    it('should auto-merge feature branches into main', () => {
      expect(strategy.shouldAutoMerge('feature/test', 'main')).toBe(true);
    });

    it('should not auto-merge between non-feature branches', () => {
      expect(strategy.shouldAutoMerge('develop', 'main')).toBe(false);
    });

    it('should use main as feature source branch', () => {
      expect(strategy.getFeatureSourceBranch()).toBe('main');
    });

    it('should only protect main branch', () => {
      const protectedBranches = strategy.getProtectedBranches();

      expect(protectedBranches).toEqual(['main']);
    });
  });

  describe('Trunk-based strategy', () => {
    const strategy = new BranchStrategy({ type: BranchStrategyType.TRUNK_BASED });

    it('should use main as default branch', () => {
      expect(strategy.getDefaultBranch()).toBe('main');
    });

    it('should generate short-lived branch names without feature prefix', () => {
      const name = strategy.getFeatureBranchName('quick fix');

      expect(name).toBe('quick-fix');
    });

    it('should auto-merge any branch into main', () => {
      expect(strategy.shouldAutoMerge('any-branch', 'main')).toBe(true);
      expect(strategy.shouldAutoMerge('fix-something', 'main')).toBe(true);
    });

    it('should not auto-merge into non-main branches', () => {
      expect(strategy.shouldAutoMerge('branch-a', 'branch-b')).toBe(false);
    });
  });

  describe('custom configuration', () => {
    it('should support custom branch names', () => {
      const strategy = new BranchStrategy({
        type: BranchStrategyType.GITFLOW,
        mainBranch: 'production',
        developBranch: 'staging',
        featurePrefix: 'feat/',
      });

      expect(strategy.getDefaultBranch()).toBe('staging');
      expect(strategy.getProductionBranch()).toBe('production');
      expect(strategy.getFeatureBranchName('test')).toBe('feat/test');
    });

    it('should return strategy type', () => {
      const strategy = new BranchStrategy({ type: BranchStrategyType.GITHUB_FLOW });

      expect(strategy.getStrategyType()).toBe(BranchStrategyType.GITHUB_FLOW);
    });

    it('should slugify feature names correctly', () => {
      const strategy = new BranchStrategy({ type: BranchStrategyType.GITHUB_FLOW });

      expect(strategy.getFeatureBranchName('Add User   Auth!!!')).toBe('feature/add-user-auth');
      expect(strategy.getFeatureBranchName('UPPER CASE')).toBe('feature/upper-case');
    });
  });
});

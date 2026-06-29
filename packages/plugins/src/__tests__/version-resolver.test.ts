import { describe, it, expect, beforeEach } from 'vitest';

import { VersionResolver } from '../marketplace/version-resolver.js';

describe('VersionResolver', () => {
  let resolver: VersionResolver;

  beforeEach(() => {
    resolver = new VersionResolver();
  });

  describe('parse', () => {
    it('should parse a standard semver version', () => {
      const result = resolver.parse('1.2.3');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(2);
      expect(result.patch).toBe(3);
    });

    it('should parse a version with prerelease', () => {
      const result = resolver.parse('2.0.0-beta.1');
      expect(result.major).toBe(2);
      expect(result.prerelease).toBe('beta.1');
    });

    it('should throw for invalid version format', () => {
      expect(() => resolver.parse('not-a-version')).toThrow('Invalid semver');
    });

    it('should throw for incomplete version', () => {
      expect(() => resolver.parse('1.2')).toThrow('Invalid semver');
    });
  });

  describe('compare', () => {
    it('should compare versions correctly (greater)', () => {
      expect(resolver.compare('2.0.0', '1.0.0')).toBe(1);
    });

    it('should compare versions correctly (lesser)', () => {
      expect(resolver.compare('1.0.0', '2.0.0')).toBe(-1);
    });

    it('should compare equal versions', () => {
      expect(resolver.compare('1.0.0', '1.0.0')).toBe(0);
    });

    it('should compare minor versions', () => {
      expect(resolver.compare('1.2.0', '1.1.0')).toBe(1);
    });

    it('should compare patch versions', () => {
      expect(resolver.compare('1.0.2', '1.0.1')).toBe(1);
    });

    it('should rank prerelease lower than release', () => {
      expect(resolver.compare('1.0.0-beta', '1.0.0')).toBe(-1);
    });
  });

  describe('satisfies', () => {
    it('should match exact version', () => {
      expect(resolver.satisfies('1.0.0', '1.0.0')).toBe(true);
      expect(resolver.satisfies('1.0.1', '1.0.0')).toBe(false);
    });

    it('should match wildcard range', () => {
      expect(resolver.satisfies('3.5.7', '*')).toBe(true);
    });

    it('should match caret range (^)', () => {
      expect(resolver.satisfies('1.2.3', '^1.0.0')).toBe(true);
      expect(resolver.satisfies('1.9.9', '^1.0.0')).toBe(true);
      expect(resolver.satisfies('2.0.0', '^1.0.0')).toBe(false);
    });

    it('should match tilde range (~)', () => {
      expect(resolver.satisfies('1.2.5', '~1.2.3')).toBe(true);
      expect(resolver.satisfies('1.3.0', '~1.2.3')).toBe(false);
    });

    it('should match >= range', () => {
      expect(resolver.satisfies('2.0.0', '>=1.0.0')).toBe(true);
      expect(resolver.satisfies('0.9.0', '>=1.0.0')).toBe(false);
    });

    it('should match > range', () => {
      expect(resolver.satisfies('1.0.1', '>1.0.0')).toBe(true);
      expect(resolver.satisfies('1.0.0', '>1.0.0')).toBe(false);
    });

    it('should match <= range', () => {
      expect(resolver.satisfies('1.0.0', '<=1.0.0')).toBe(true);
      expect(resolver.satisfies('1.0.1', '<=1.0.0')).toBe(false);
    });

    it('should match < range', () => {
      expect(resolver.satisfies('0.9.9', '<1.0.0')).toBe(true);
      expect(resolver.satisfies('1.0.0', '<1.0.0')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should resolve the latest matching version', () => {
      const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0'];
      const result = resolver.resolve('^1.0.0', versions);
      expect(result).toBe('1.2.0');
    });

    it('should return null if no version matches', () => {
      const versions = ['1.0.0', '1.1.0'];
      const result = resolver.resolve('^2.0.0', versions);
      expect(result).toBeNull();
    });
  });

  describe('isBreakingChange', () => {
    it('should detect breaking changes (major version bump)', () => {
      expect(resolver.isBreakingChange('1.0.0', '2.0.0')).toBe(true);
    });

    it('should not flag minor version bump as breaking', () => {
      expect(resolver.isBreakingChange('1.0.0', '1.1.0')).toBe(false);
    });

    it('should not flag patch version bump as breaking', () => {
      expect(resolver.isBreakingChange('1.0.0', '1.0.1')).toBe(false);
    });
  });

  describe('getUpgradePath', () => {
    it('should compute upgrade path through major versions', () => {
      const versions = ['1.0.0', '1.1.0', '2.0.0', '2.1.0', '3.0.0'];
      const path = resolver.getUpgradePath('1.0.0', '3.0.0', versions);
      expect(path[0]).toBe('1.0.0');
      expect(path).toContain('2.0.0');
      expect(path[path.length - 1]).toBe('3.0.0');
    });

    it('should return single version when from equals to', () => {
      const versions = ['1.0.0', '1.1.0', '2.0.0'];
      const path = resolver.getUpgradePath('1.0.0', '1.0.0', versions);
      expect(path).toEqual(['1.0.0']);
    });

    it('should throw when version is not found', () => {
      const versions = ['1.0.0', '2.0.0'];
      expect(() => resolver.getUpgradePath('1.0.0', '3.0.0', versions)).toThrow('not found');
    });
  });

  describe('isCompatible', () => {
    it('should check version is compatible with minimum', () => {
      expect(resolver.isCompatible('2.0.0', '1.0.0')).toBe(true);
    });

    it('should check version is not compatible when below minimum', () => {
      expect(resolver.isCompatible('0.9.0', '1.0.0')).toBe(false);
    });

    it('should check equal versions are compatible', () => {
      expect(resolver.isCompatible('1.0.0', '1.0.0')).toBe(true);
    });
  });
});

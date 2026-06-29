import { describe, it, expect, beforeEach } from 'vitest';

import {
  ConflictResolver,
  ResolutionStrategy,
  ConflictType,
  ConflictInfo,
} from '../index.js';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  describe('detectConflicts', () => {
    it('should detect content conflicts when both sides modify the same file', () => {
      const base = new Map([['file.ts', 'original']]);
      const ours = new Map([['file.ts', 'our change']]);
      const theirs = new Map([['file.ts', 'their change']]);

      const conflicts = resolver.detectConflicts(base, ours, theirs);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].file).toBe('file.ts');
      expect(conflicts[0].type).toBe(ConflictType.CONTENT);
      expect(conflicts[0].ours).toBe('our change');
      expect(conflicts[0].theirs).toBe('their change');
    });

    it('should detect add-add conflicts when both add same file with different content', () => {
      const base = new Map<string, string>();
      const ours = new Map([['new-file.ts', 'our version']]);
      const theirs = new Map([['new-file.ts', 'their version']]);

      const conflicts = resolver.detectConflicts(base, ours, theirs);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe(ConflictType.ADD_ADD);
    });

    it('should detect modify-delete conflicts', () => {
      const base = new Map([['file.ts', 'original']]);
      const ours = new Map<string, string>(); // deleted
      const theirs = new Map([['file.ts', 'modified']]);

      const conflicts = resolver.detectConflicts(base, ours, theirs);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe(ConflictType.MODIFY_DELETE);
    });

    it('should not report conflicts when changes are identical', () => {
      const base = new Map([['file.ts', 'original']]);
      const ours = new Map([['file.ts', 'same change']]);
      const theirs = new Map([['file.ts', 'same change']]);

      const conflicts = resolver.detectConflicts(base, ours, theirs);

      expect(conflicts).toHaveLength(0);
    });

    it('should not report conflicts when only one side modifies', () => {
      const base = new Map([['file.ts', 'original']]);
      const ours = new Map([['file.ts', 'modified']]);
      const theirs = new Map([['file.ts', 'original']]);

      const conflicts = resolver.detectConflicts(base, ours, theirs);

      expect(conflicts).toHaveLength(0);
    });

    it('should handle multiple conflicts across files', () => {
      const base = new Map([
        ['a.ts', 'a-original'],
        ['b.ts', 'b-original'],
        ['c.ts', 'c-original'],
      ]);
      const ours = new Map([
        ['a.ts', 'a-ours'],
        ['b.ts', 'b-ours'],
        ['c.ts', 'c-original'],
      ]);
      const theirs = new Map([
        ['a.ts', 'a-theirs'],
        ['b.ts', 'b-theirs'],
        ['c.ts', 'c-theirs'],
      ]);

      const conflicts = resolver.detectConflicts(base, ours, theirs);

      expect(conflicts).toHaveLength(2);
      expect(conflicts.map((c) => c.file).sort()).toEqual(['a.ts', 'b.ts']);
    });
  });

  describe('resolve', () => {
    const conflicts: ConflictInfo[] = [
      { file: 'a.ts', type: ConflictType.CONTENT, ours: 'a-ours', theirs: 'a-theirs' },
      { file: 'b.ts', type: ConflictType.CONTENT, ours: 'b-ours', theirs: 'b-theirs' },
    ];

    it('should mark all as unresolved with default MANUAL strategy', () => {
      const result = resolver.resolve(conflicts);

      expect(result.unresolved).toHaveLength(2);
      expect(result.resolved).toHaveLength(0);
      expect(result.hasConflicts).toBe(true);
    });

    it('should auto-resolve with OURS strategy', () => {
      const oursResolver = new ConflictResolver(ResolutionStrategy.OURS);
      const result = oursResolver.resolve(conflicts);

      expect(result.resolved).toHaveLength(2);
      expect(result.unresolved).toHaveLength(0);
      expect(result.hasConflicts).toBe(false);
      expect(result.resolved[0].resolvedContent).toBe('a-ours');
    });

    it('should auto-resolve with THEIRS strategy', () => {
      const theirsResolver = new ConflictResolver(ResolutionStrategy.THEIRS);
      const result = theirsResolver.resolve(conflicts);

      expect(result.resolved).toHaveLength(2);
      expect(result.resolved[0].resolvedContent).toBe('a-theirs');
      expect(result.resolved[1].resolvedContent).toBe('b-theirs');
    });

    it('should support per-file strategy overrides', () => {
      const overrides = new Map<string, ResolutionStrategy>([
        ['a.ts', ResolutionStrategy.OURS],
      ]);

      const result = resolver.resolve(conflicts, overrides);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].file).toBe('a.ts');
      expect(result.unresolved).toHaveLength(1);
      expect(result.unresolved[0].file).toBe('b.ts');
    });
  });

  describe('individual resolution methods', () => {
    const conflict: ConflictInfo = {
      file: 'test.ts',
      type: ConflictType.CONTENT,
      ours: 'our content',
      theirs: 'their content',
    };

    it('should resolve using ours strategy', () => {
      const resolution = resolver.resolveOurs(conflict);

      expect(resolution.file).toBe('test.ts');
      expect(resolution.strategy).toBe(ResolutionStrategy.OURS);
      expect(resolution.resolvedContent).toBe('our content');
    });

    it('should resolve using theirs strategy', () => {
      const resolution = resolver.resolveTheirs(conflict);

      expect(resolution.file).toBe('test.ts');
      expect(resolution.strategy).toBe(ResolutionStrategy.THEIRS);
      expect(resolution.resolvedContent).toBe('their content');
    });

    it('should resolve manually with custom content', () => {
      const resolution = resolver.resolveManual(conflict, 'merged content');

      expect(resolution.strategy).toBe(ResolutionStrategy.MANUAL);
      expect(resolution.resolvedContent).toBe('merged content');
    });
  });

  describe('utility methods', () => {
    it('should get and set default strategy', () => {
      expect(resolver.getDefaultStrategy()).toBe(ResolutionStrategy.MANUAL);

      resolver.setDefaultStrategy(ResolutionStrategy.OURS);

      expect(resolver.getDefaultStrategy()).toBe(ResolutionStrategy.OURS);
    });

    it('should check if conflicts can be auto-resolved', () => {
      const autoResolvable: ConflictInfo[] = [
        { file: 'a.ts', type: ConflictType.CONTENT, ours: 'a', theirs: 'b' },
      ];
      const notResolvable: ConflictInfo[] = [
        { file: 'b.ts', type: ConflictType.MODIFY_DELETE, ours: 'content', theirs: undefined },
      ];

      expect(resolver.canAutoResolve(autoResolvable)).toBe(true);
      expect(resolver.canAutoResolve(notResolvable)).toBe(false);
    });
  });
});

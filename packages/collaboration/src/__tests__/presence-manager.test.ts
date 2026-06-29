import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PresenceManager } from '../realtime/presence-manager.js';

describe('PresenceManager', () => {
  let manager: PresenceManager;

  beforeEach(() => {
    manager = new PresenceManager();
  });

  describe('join', () => {
    it('should add a user to project presence', () => {
      const info = manager.join('user-1', 'proj-1');

      expect(info.userId).toBe('user-1');
      expect(info.projectId).toBe('proj-1');
      expect(info.activeFile).toBeNull();
      expect(info.cursorPosition).toBeNull();
      expect(info.lastSeenAt).toBeInstanceOf(Date);
    });

    it('should allow multiple users in the same project', () => {
      manager.join('user-1', 'proj-1');
      manager.join('user-2', 'proj-1');

      const presence = manager.getProjectPresence('proj-1');
      expect(presence).toHaveLength(2);
    });
  });

  describe('leave', () => {
    it('should remove a user from project presence', () => {
      manager.join('user-1', 'proj-1');
      manager.leave('user-1', 'proj-1');

      const presence = manager.getProjectPresence('proj-1');
      expect(presence).toHaveLength(0);
    });

    it('should not affect other users when one leaves', () => {
      manager.join('user-1', 'proj-1');
      manager.join('user-2', 'proj-1');
      manager.leave('user-1', 'proj-1');

      const presence = manager.getProjectPresence('proj-1');
      expect(presence).toHaveLength(1);
      expect(presence[0].userId).toBe('user-2');
    });
  });

  describe('updateCursor', () => {
    it('should update user cursor position', () => {
      manager.join('user-1', 'proj-1');

      const updated = manager.updateCursor('user-1', 'proj-1', {
        file: 'src/index.ts',
        line: 10,
        column: 5,
      });

      expect(updated).not.toBeNull();
      expect(updated!.activeFile).toBe('src/index.ts');
      expect(updated!.cursorPosition).toEqual({ line: 10, column: 5 });
    });

    it('should return null for non-present user', () => {
      const result = manager.updateCursor('unknown', 'proj-1', {
        file: 'src/index.ts',
        line: 1,
        column: 1,
      });

      expect(result).toBeNull();
    });
  });

  describe('getProjectPresence', () => {
    it('should return empty array for unknown project', () => {
      const presence = manager.getProjectPresence('unknown-project');
      expect(presence).toEqual([]);
    });

    it('should filter out stale users based on heartbeat timeout', () => {
      manager.join('user-1', 'proj-1');

      // Simulate stale presence by manipulating time
      vi.useFakeTimers();
      vi.advanceTimersByTime(31000); // past 30s timeout

      const presence = manager.getProjectPresence('proj-1');
      expect(presence).toHaveLength(0);

      vi.useRealTimers();
    });
  });

  describe('heartbeat', () => {
    it('should update lastSeenAt timestamp', () => {
      const joined = manager.join('user-1', 'proj-1');
      const originalTime = joined.lastSeenAt.getTime();

      // Small delay to ensure different timestamp
      const result = manager.heartbeat('user-1', 'proj-1');

      expect(result).not.toBeNull();
      expect(result!.lastSeenAt.getTime()).toBeGreaterThanOrEqual(originalTime);
    });

    it('should return null for non-present user', () => {
      const result = manager.heartbeat('unknown', 'proj-1');
      expect(result).toBeNull();
    });
  });

  describe('isPresent', () => {
    it('should return true for active user', () => {
      manager.join('user-1', 'proj-1');
      expect(manager.isPresent('user-1', 'proj-1')).toBe(true);
    });

    it('should return false for unknown user', () => {
      expect(manager.isPresent('unknown', 'proj-1')).toBe(false);
    });

    it('should return false for stale user', () => {
      manager.join('user-1', 'proj-1');

      vi.useFakeTimers();
      vi.advanceTimersByTime(31000);

      expect(manager.isPresent('user-1', 'proj-1')).toBe(false);

      vi.useRealTimers();
    });
  });
});

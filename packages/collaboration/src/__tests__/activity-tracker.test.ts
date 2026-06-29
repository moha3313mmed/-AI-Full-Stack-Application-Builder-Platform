import { describe, it, expect, beforeEach } from 'vitest';

import { ActivityTracker } from '../activity/activity-tracker.js';
import { ActivityType } from '../activity/activity-types.js';

describe('ActivityTracker', () => {
  let tracker: ActivityTracker;

  beforeEach(() => {
    tracker = new ActivityTracker();
  });

  describe('track', () => {
    it('should record an activity event', () => {
      const event = tracker.track({
        projectId: 'proj-1',
        userId: 'user-1',
        type: ActivityType.FILE_CREATED,
        description: 'Created src/index.ts',
        metadata: { filePath: 'src/index.ts' },
      });

      expect(event.id).toBeDefined();
      expect(event.projectId).toBe('proj-1');
      expect(event.userId).toBe('user-1');
      expect(event.type).toBe(ActivityType.FILE_CREATED);
      expect(event.description).toBe('Created src/index.ts');
      expect(event.metadata).toEqual({ filePath: 'src/index.ts' });
      expect(event.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for each event', () => {
      const event1 = tracker.track({
        projectId: 'proj-1',
        userId: 'user-1',
        type: ActivityType.FILE_CREATED,
        description: 'Event 1',
        metadata: {},
      });

      const event2 = tracker.track({
        projectId: 'proj-1',
        userId: 'user-1',
        type: ActivityType.FILE_MODIFIED,
        description: 'Event 2',
        metadata: {},
      });

      expect(event1.id).not.toBe(event2.id);
    });
  });

  describe('getProjectActivity', () => {
    it('should return activity events for a project', () => {
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'Event 1', metadata: {} });
      tracker.track({ projectId: 'proj-1', userId: 'user-2', type: ActivityType.FILE_MODIFIED, description: 'Event 2', metadata: {} });
      tracker.track({ projectId: 'proj-2', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'Other project', metadata: {} });

      const events = tracker.getProjectActivity('proj-1');
      expect(events).toHaveLength(2);
    });

    it('should filter by event type', () => {
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'Created', metadata: {} });
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_MODIFIED, description: 'Modified', metadata: {} });
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'Created 2', metadata: {} });

      const events = tracker.getProjectActivity('proj-1', { type: ActivityType.FILE_CREATED });
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.type === ActivityType.FILE_CREATED)).toBe(true);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000); // 1 day ago
      const futureDate = new Date(now.getTime() + 86400000); // 1 day from now

      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'Event', metadata: {} });

      const eventsInRange = tracker.getProjectActivity('proj-1', {
        startDate: pastDate,
        endDate: futureDate,
      });
      expect(eventsInRange).toHaveLength(1);

      const eventsOutOfRange = tracker.getProjectActivity('proj-1', {
        startDate: futureDate,
      });
      expect(eventsOutOfRange).toHaveLength(0);
    });

    it('should support limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: `Event ${i}`, metadata: {} });
      }

      const page1 = tracker.getProjectActivity('proj-1', { limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = tracker.getProjectActivity('proj-1', { limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = tracker.getProjectActivity('proj-1', { limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);
    });

    it('should return events sorted by newest first', () => {
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'First', metadata: {} });
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_MODIFIED, description: 'Second', metadata: {} });

      const events = tracker.getProjectActivity('proj-1');
      expect(events[0].createdAt.getTime()).toBeGreaterThanOrEqual(events[1].createdAt.getTime());
    });
  });

  describe('getUserActivity', () => {
    it('should return activity events for a user', () => {
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'Event 1', metadata: {} });
      tracker.track({ projectId: 'proj-2', userId: 'user-1', type: ActivityType.FILE_MODIFIED, description: 'Event 2', metadata: {} });
      tracker.track({ projectId: 'proj-1', userId: 'user-2', type: ActivityType.FILE_CREATED, description: 'Other user', metadata: {} });

      const events = tracker.getUserActivity('user-1');
      expect(events).toHaveLength(2);
    });

    it('should filter user activity by type', () => {
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.DEPLOYMENT_STARTED, description: 'Deploy 1', metadata: {} });
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'File', metadata: {} });
      tracker.track({ projectId: 'proj-2', userId: 'user-1', type: ActivityType.DEPLOYMENT_STARTED, description: 'Deploy 2', metadata: {} });

      const events = tracker.getUserActivity('user-1', { type: ActivityType.DEPLOYMENT_STARTED });
      expect(events).toHaveLength(2);
    });
  });

  describe('getProjectActivityCount', () => {
    it('should return the total count of events for a project', () => {
      tracker.track({ projectId: 'proj-1', userId: 'user-1', type: ActivityType.FILE_CREATED, description: 'Event 1', metadata: {} });
      tracker.track({ projectId: 'proj-1', userId: 'user-2', type: ActivityType.FILE_MODIFIED, description: 'Event 2', metadata: {} });

      expect(tracker.getProjectActivityCount('proj-1')).toBe(2);
      expect(tracker.getProjectActivityCount('proj-2')).toBe(0);
    });
  });
});

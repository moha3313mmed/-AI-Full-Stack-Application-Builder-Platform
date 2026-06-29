import { ActivityEvent } from '../types/index.js';

import { ActivityType } from './activity-types.js';

export interface ActivityFilterOptions {
  type?: ActivityType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * ActivityTracker records and queries project activity events.
 */
export class ActivityTracker {
  private events: ActivityEvent[] = [];

  /**
   * Record a new activity event.
   */
  track(event: Omit<ActivityEvent, 'id' | 'createdAt'>): ActivityEvent {
    const activityEvent: ActivityEvent = {
      id: this.generateId(),
      projectId: event.projectId,
      userId: event.userId,
      type: event.type,
      description: event.description,
      metadata: event.metadata,
      createdAt: new Date(),
    };

    this.events.push(activityEvent);
    return activityEvent;
  }

  /**
   * Get activity events for a project with optional filtering.
   */
  getProjectActivity(projectId: string, options: ActivityFilterOptions = {}): ActivityEvent[] {
    let filtered = this.events.filter((e) => e.projectId === projectId);

    if (options.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }

    if (options.startDate) {
      filtered = filtered.filter((e) => e.createdAt >= options.startDate!);
    }

    if (options.endDate) {
      filtered = filtered.filter((e) => e.createdAt <= options.endDate!);
    }

    // Sort by newest first
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options.offset || 0;
    const limit = options.limit || filtered.length;

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get activity events for a user with optional filtering.
   */
  getUserActivity(userId: string, options: ActivityFilterOptions = {}): ActivityEvent[] {
    let filtered = this.events.filter((e) => e.userId === userId);

    if (options.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }

    if (options.startDate) {
      filtered = filtered.filter((e) => e.createdAt >= options.startDate!);
    }

    if (options.endDate) {
      filtered = filtered.filter((e) => e.createdAt <= options.endDate!);
    }

    // Sort by newest first
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options.offset || 0;
    const limit = options.limit || filtered.length;

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get the total count of events for a project.
   */
  getProjectActivityCount(projectId: string): number {
    return this.events.filter((e) => e.projectId === projectId).length;
  }

  private generateId(): string {
    return `activity-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

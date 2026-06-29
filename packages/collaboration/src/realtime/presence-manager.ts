import { PresenceInfo } from '../types/index.js';

const HEARTBEAT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * PresenceManager tracks user presence in projects.
 */
export class PresenceManager {
  private presence: Map<string, Map<string, PresenceInfo>> = new Map();

  /**
   * User joins a project.
   */
  join(userId: string, projectId: string): PresenceInfo {
    if (!this.presence.has(projectId)) {
      this.presence.set(projectId, new Map());
    }

    const info: PresenceInfo = {
      userId,
      projectId,
      activeFile: null,
      cursorPosition: null,
      lastSeenAt: new Date(),
    };

    this.presence.get(projectId)!.set(userId, info);
    return info;
  }

  /**
   * User leaves a project.
   */
  leave(userId: string, projectId: string): void {
    this.presence.get(projectId)?.delete(userId);
  }

  /**
   * Update a user's cursor position.
   */
  updateCursor(
    userId: string,
    projectId: string,
    position: { file: string; line: number; column: number },
  ): PresenceInfo | null {
    const projectPresence = this.presence.get(projectId);
    if (!projectPresence) return null;

    const info = projectPresence.get(userId);
    if (!info) return null;

    const updated: PresenceInfo = {
      ...info,
      activeFile: position.file,
      cursorPosition: { line: position.line, column: position.column },
      lastSeenAt: new Date(),
    };

    projectPresence.set(userId, updated);
    return updated;
  }

  /**
   * Get all active users in a project.
   */
  getProjectPresence(projectId: string): PresenceInfo[] {
    const projectPresence = this.presence.get(projectId);
    if (!projectPresence) return [];

    const now = Date.now();
    const active: PresenceInfo[] = [];

    for (const [userId, info] of projectPresence.entries()) {
      if (now - info.lastSeenAt.getTime() > HEARTBEAT_TIMEOUT_MS) {
        projectPresence.delete(userId);
      } else {
        active.push(info);
      }
    }

    return active;
  }

  /**
   * Send a heartbeat to keep the user's presence active.
   */
  heartbeat(userId: string, projectId: string): PresenceInfo | null {
    const projectPresence = this.presence.get(projectId);
    if (!projectPresence) return null;

    const info = projectPresence.get(userId);
    if (!info) return null;

    const updated: PresenceInfo = {
      ...info,
      lastSeenAt: new Date(),
    };

    projectPresence.set(userId, updated);
    return updated;
  }

  /**
   * Check if a user is present in a project.
   */
  isPresent(userId: string, projectId: string): boolean {
    const projectPresence = this.presence.get(projectId);
    if (!projectPresence) return false;

    const info = projectPresence.get(userId);
    if (!info) return false;

    return Date.now() - info.lastSeenAt.getTime() <= HEARTBEAT_TIMEOUT_MS;
  }
}

// @builder/collaboration - Team Collaboration, Permissions, Comments, and Activity Tracking
//
// This package provides collaboration features including role-based permissions,
// threaded code comments, activity tracking, and real-time presence management.

// ============================================================================
// Types
// ============================================================================

export {
  TeamRole,
  Permission,
  type TeamMember,
  type Comment,
  type CodeReview,
  type ActivityEvent,
  type PresenceInfo,
} from './types/index.js';

// ============================================================================
// Permissions
// ============================================================================

export { PermissionManager } from './permissions/permission-manager.js';
export { RoleHierarchy } from './permissions/role-hierarchy.js';

// ============================================================================
// Comments
// ============================================================================

export { CommentService } from './comments/comment-service.js';

// ============================================================================
// Activity
// ============================================================================

export { ActivityTracker, type ActivityFilterOptions } from './activity/activity-tracker.js';
export { ActivityType } from './activity/activity-types.js';

// ============================================================================
// Realtime
// ============================================================================

export { PresenceManager } from './realtime/presence-manager.js';

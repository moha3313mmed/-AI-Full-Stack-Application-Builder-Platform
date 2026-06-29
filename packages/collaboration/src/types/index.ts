// @builder/collaboration - Types and Interfaces

// =============================================================================
// Enums
// =============================================================================

export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum Permission {
  PROJECT_VIEW = 'PROJECT_VIEW',
  PROJECT_EDIT = 'PROJECT_EDIT',
  PROJECT_DELETE = 'PROJECT_DELETE',
  PROJECT_DEPLOY = 'PROJECT_DEPLOY',
  TEAM_MANAGE = 'TEAM_MANAGE',
  COMMENT_CREATE = 'COMMENT_CREATE',
  COMMENT_DELETE = 'COMMENT_DELETE',
  CODE_REVIEW = 'CODE_REVIEW',
}

// =============================================================================
// Interfaces
// =============================================================================

export interface TeamMember {
  userId: string;
  role: TeamRole;
  permissions: Permission[];
  joinedAt: Date;
}

export interface Comment {
  id: string;
  projectId: string;
  authorId: string;
  content: string;
  filePath?: string | null;
  lineNumber?: number | null;
  threadId?: string | null;
  resolvedAt?: Date | null;
  createdAt: Date;
}

export interface CodeReview {
  id: string;
  projectId: string;
  authorId: string;
  status: string;
  title: string;
  description: string;
  filePaths: string[];
  comments: Comment[];
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  userId: string;
  type: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface PresenceInfo {
  userId: string;
  projectId: string;
  activeFile?: string | null;
  cursorPosition?: { line: number; column: number } | null;
  lastSeenAt: Date;
}

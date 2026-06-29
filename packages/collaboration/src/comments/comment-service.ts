import { Comment } from '../types/index.js';

/**
 * CommentService manages threaded comments on code.
 */
export class CommentService {
  private comments: Map<string, Comment> = new Map();

  /**
   * Create a new comment.
   */
  createComment(params: {
    projectId: string;
    authorId: string;
    content: string;
    filePath?: string;
    lineNumber?: number;
    threadId?: string;
  }): Comment {
    const comment: Comment = {
      id: this.generateId(),
      projectId: params.projectId,
      authorId: params.authorId,
      content: params.content,
      filePath: params.filePath || null,
      lineNumber: params.lineNumber || null,
      threadId: params.threadId || null,
      resolvedAt: null,
      createdAt: new Date(),
    };

    this.comments.set(comment.id, comment);
    return comment;
  }

  /**
   * Reply to an existing comment thread.
   */
  replyToThread(params: {
    threadId: string;
    authorId: string;
    content: string;
  }): Comment {
    const parentComment = this.comments.get(params.threadId);
    if (!parentComment) {
      throw new Error(`Comment thread "${params.threadId}" not found`);
    }

    return this.createComment({
      projectId: parentComment.projectId,
      authorId: params.authorId,
      content: params.content,
      filePath: parentComment.filePath || undefined,
      lineNumber: parentComment.lineNumber || undefined,
      threadId: params.threadId,
    });
  }

  /**
   * Resolve a comment thread.
   */
  resolveThread(threadId: string): Comment {
    const comment = this.comments.get(threadId);
    if (!comment) {
      throw new Error(`Comment "${threadId}" not found`);
    }

    const resolved: Comment = {
      ...comment,
      resolvedAt: new Date(),
    };

    this.comments.set(threadId, resolved);
    return resolved;
  }

  /**
   * List comments for a project, optionally filtered by file path.
   */
  listComments(projectId: string, filePath?: string): Comment[] {
    const projectComments: Comment[] = [];

    for (const comment of this.comments.values()) {
      if (comment.projectId !== projectId) continue;
      if (filePath && comment.filePath !== filePath) continue;
      projectComments.push(comment);
    }

    return projectComments.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  /**
   * Get all comments in a thread.
   */
  getThread(threadId: string): Comment[] {
    const rootComment = this.comments.get(threadId);
    if (!rootComment) {
      throw new Error(`Comment thread "${threadId}" not found`);
    }

    const threadComments: Comment[] = [rootComment];

    for (const comment of this.comments.values()) {
      if (comment.threadId === threadId) {
        threadComments.push(comment);
      }
    }

    return threadComments.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  /**
   * Get a comment by ID.
   */
  getComment(id: string): Comment | undefined {
    return this.comments.get(id);
  }

  /**
   * Delete a comment.
   */
  deleteComment(id: string): boolean {
    return this.comments.delete(id);
  }

  private generateId(): string {
    return `comment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

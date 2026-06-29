import { describe, it, expect, beforeEach } from 'vitest';

import { CommentService } from '../comments/comment-service.js';

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(() => {
    service = new CommentService();
  });

  describe('createComment', () => {
    it('should create a comment with required fields', () => {
      const comment = service.createComment({
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'This needs refactoring',
      });

      expect(comment.id).toBeDefined();
      expect(comment.projectId).toBe('proj-1');
      expect(comment.authorId).toBe('user-1');
      expect(comment.content).toBe('This needs refactoring');
      expect(comment.threadId).toBeNull();
      expect(comment.resolvedAt).toBeNull();
      expect(comment.createdAt).toBeInstanceOf(Date);
    });

    it('should create a comment with file path and line number', () => {
      const comment = service.createComment({
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'Consider using const here',
        filePath: 'src/index.ts',
        lineNumber: 42,
      });

      expect(comment.filePath).toBe('src/index.ts');
      expect(comment.lineNumber).toBe(42);
    });

    it('should create a comment with a thread reference', () => {
      const parent = service.createComment({
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'Parent comment',
      });

      const reply = service.createComment({
        projectId: 'proj-1',
        authorId: 'user-2',
        content: 'Reply comment',
        threadId: parent.id,
      });

      expect(reply.threadId).toBe(parent.id);
    });
  });

  describe('replyToThread', () => {
    it('should create a reply to an existing comment', () => {
      const parent = service.createComment({
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'Original comment',
        filePath: 'src/app.ts',
        lineNumber: 10,
      });

      const reply = service.replyToThread({
        threadId: parent.id,
        authorId: 'user-2',
        content: 'I agree, good point',
      });

      expect(reply.threadId).toBe(parent.id);
      expect(reply.projectId).toBe('proj-1');
      expect(reply.filePath).toBe('src/app.ts');
      expect(reply.lineNumber).toBe(10);
    });

    it('should throw error for non-existent thread', () => {
      expect(() =>
        service.replyToThread({
          threadId: 'non-existent',
          authorId: 'user-1',
          content: 'Reply',
        }),
      ).toThrow('Comment thread "non-existent" not found');
    });
  });

  describe('resolveThread', () => {
    it('should resolve a comment by setting resolvedAt', () => {
      const comment = service.createComment({
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'Fix this bug',
      });

      const resolved = service.resolveThread(comment.id);

      expect(resolved.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent comment', () => {
      expect(() => service.resolveThread('non-existent')).toThrow(
        'Comment "non-existent" not found',
      );
    });
  });

  describe('listComments', () => {
    it('should list all comments for a project', () => {
      service.createComment({ projectId: 'proj-1', authorId: 'user-1', content: 'Comment 1' });
      service.createComment({ projectId: 'proj-1', authorId: 'user-2', content: 'Comment 2' });
      service.createComment({ projectId: 'proj-2', authorId: 'user-1', content: 'Other project' });

      const comments = service.listComments('proj-1');
      expect(comments).toHaveLength(2);
    });

    it('should filter comments by file path', () => {
      service.createComment({
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'Comment on app.ts',
        filePath: 'src/app.ts',
      });
      service.createComment({
        projectId: 'proj-1',
        authorId: 'user-2',
        content: 'Comment on main.ts',
        filePath: 'src/main.ts',
      });

      const comments = service.listComments('proj-1', 'src/app.ts');
      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe('Comment on app.ts');
    });

    it('should return comments sorted by creation time', () => {
      const c1 = service.createComment({ projectId: 'proj-1', authorId: 'user-1', content: 'First' });
      const c2 = service.createComment({ projectId: 'proj-1', authorId: 'user-2', content: 'Second' });

      const comments = service.listComments('proj-1');
      expect(comments[0].id).toBe(c1.id);
      expect(comments[1].id).toBe(c2.id);
    });
  });

  describe('getThread', () => {
    it('should get all comments in a thread', () => {
      const parent = service.createComment({
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'Parent',
      });

      service.replyToThread({ threadId: parent.id, authorId: 'user-2', content: 'Reply 1' });
      service.replyToThread({ threadId: parent.id, authorId: 'user-3', content: 'Reply 2' });

      const thread = service.getThread(parent.id);
      expect(thread).toHaveLength(3);
      expect(thread[0].content).toBe('Parent');
    });

    it('should throw error for non-existent thread', () => {
      expect(() => service.getThread('non-existent')).toThrow(
        'Comment thread "non-existent" not found',
      );
    });
  });

  describe('deleteComment', () => {
    it('should delete a comment', () => {
      const comment = service.createComment({
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'To be deleted',
      });

      expect(service.deleteComment(comment.id)).toBe(true);
      expect(service.getComment(comment.id)).toBeUndefined();
    });

    it('should return false for non-existent comment', () => {
      expect(service.deleteComment('non-existent')).toBe(false);
    });
  });
});

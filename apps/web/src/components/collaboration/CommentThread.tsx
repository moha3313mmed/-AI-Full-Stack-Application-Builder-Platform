'use client';

import { Send, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Comment, CreateCommentInput } from '@/hooks/useComments';

interface CommentThreadProps {
  comments: Comment[];
  onCreateComment: (input: CreateCommentInput) => void;
  onDeleteComment: (commentId: string) => void;
}

export function CommentThread({ comments, onCreateComment, onDeleteComment }: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onCreateComment({ content: newComment.trim() });
    setNewComment('');
  };

  const handleReply = (parentId: string, content: string) => {
    onCreateComment({ content, parentId });
  };

  // Build nested structure
  const topLevel = comments.filter((c) => !c.parentId);
  const repliesMap = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (c.parentId) {
      if (!acc[c.parentId]) acc[c.parentId] = [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {topLevel.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">
              No comments yet. Start the conversation!
            </p>
          ) : (
            topLevel.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={repliesMap[comment.id] || []}
                onReply={handleReply}
                onDelete={onDeleteComment}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-3 py-2">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="h-7 text-xs"
        />
        <Button type="submit" size="sm" className="h-7 w-7 p-0" disabled={!newComment.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  onReply: (parentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}

function CommentItem({ comment, replies, onReply, onDelete }: CommentItemProps) {
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);

  const initials = comment.authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleReplySubmit = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText('');
    setShowReply(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Avatar className="h-5 w-5 shrink-0">
          <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium">{comment.authorName}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatDate(comment.createdAt)}
            </span>
          </div>
          <p className="text-xs text-foreground mt-0.5">{comment.content}</p>
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowReply(!showReply)}
            >
              Reply
            </button>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(comment.id)}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Reply input */}
      {showReply && (
        <div className="ml-7 flex items-center gap-1.5">
          <Input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="h-6 text-[10px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleReplySubmit();
            }}
          />
          <Button size="sm" className="h-6 px-2 text-[10px]" onClick={handleReplySubmit}>
            Reply
          </Button>
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-7 space-y-2 border-l pl-2">
          {replies.map((reply) => {
            const replyInitials = reply.authorName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            return (
              <div key={reply.id} className="flex items-start gap-2">
                <Avatar className="h-4 w-4 shrink-0">
                  <AvatarFallback className="text-[7px]">{replyInitials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium">{reply.authorName}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {formatDate(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground mt-0.5">{reply.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

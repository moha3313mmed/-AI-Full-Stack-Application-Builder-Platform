'use client';

import { useEffect, useRef } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentStatus } from '@/hooks/useAgentStatus';
import { useChat } from '@/hooks/useChat';

import { AgentIndicator } from './AgentIndicator';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const { messages, isLoading, sendMessage } = useChat(projectId);
  const { activeAgent } = useAgentStatus(projectId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col border-l">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">AI Assistant</h3>
      </div>
      <AgentIndicator agent={activeAgent} />
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Start a conversation to build your project with AI assistance.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex gap-3 p-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}

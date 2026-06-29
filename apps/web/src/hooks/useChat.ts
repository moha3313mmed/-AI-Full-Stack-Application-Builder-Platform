'use client';

import { useCallback, useEffect, useState } from 'react';

import { wsClient } from '@/lib/websocket';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agentRole?: string;
}

export function useChat(projectId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    wsClient.connect();

    const unsubConnected = wsClient.subscribe('connected', () => {
      setIsConnected(true);
      wsClient.send('join', { projectId });
    });

    const unsubDisconnected = wsClient.subscribe('disconnected', () => {
      setIsConnected(false);
    });

    const unsubMessage = wsClient.subscribe('chat_message', (data) => {
      const message = data as ChatMessage;
      setMessages((prev) => [...prev, message]);
      setIsLoading(false);
    });

    const unsubAgentThinking = wsClient.subscribe('agent_thinking', () => {
      setIsLoading(true);
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubMessage();
      unsubAgentThinking();
      wsClient.disconnect();
    };
  }, [projectId]);

  const sendMessage = useCallback(
    (content: string) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      wsClient.send('chat_message', { projectId, content });
    },
    [projectId]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isConnected,
    isLoading,
    sendMessage,
    clearMessages,
  };
}

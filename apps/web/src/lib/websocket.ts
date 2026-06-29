import { io, type Socket } from 'socket.io-client';

import { getStoredToken } from './auth';

type MessageHandler = (data: unknown) => void;

export interface WebSocketOptions {
  url: string;
  namespace?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketClient {
  private socket: Socket | null = null;
  private url: string;
  private namespace: string;
  private shouldReconnect: boolean;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private isManualClose = false;

  constructor(options: WebSocketOptions) {
    this.url = options.url;
    this.namespace = options.namespace ?? '/agents';
    this.shouldReconnect = options.reconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  }

  connect(): void {
    if (typeof window === 'undefined') return;

    this.isManualClose = false;
    const token = getStoredToken();

    this.socket = io(`${this.url}${this.namespace}`, {
      auth: { token },
      reconnection: this.shouldReconnect,
      reconnectionDelay: this.reconnectInterval,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      this.emit('connected', null);
    });

    this.socket.on('disconnect', () => {
      this.emit('disconnected', null);
    });

    this.socket.on('connect_error', (error) => {
      this.emit('error', { message: error.message || 'WebSocket connection error' });
    });

    // Listen for agent-specific events
    this.socket.on('agent:progress', (data) => {
      this.emit('agent:progress', data);
    });

    this.socket.on('agent:complete', (data) => {
      this.emit('agent:complete', data);
    });

    this.socket.on('agent:error', (data) => {
      this.emit('agent:error', data);
    });

    this.socket.on('agent:subscribed', (data) => {
      this.emit('agent:subscribed', data);
    });

    // Generic message handler for any other events
    this.socket.onAny((event: string, data: unknown) => {
      this.emit(event, data);
      this.emit('message', { type: event, data });
    });
  }

  disconnect(): void {
    this.isManualClose = true;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  send(event: string, data?: unknown): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  subscribe(event: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const handlerSet = this.handlers.get(event);
    if (handlerSet) {
      handlerSet.add(handler);
    }

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  private emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

export const wsClient = new WebSocketClient({ url: WS_URL });

/** Dedicated WebSocket client for the /files namespace (file change events). */
export const filesWsClient = new WebSocketClient({ url: WS_URL, namespace: '/files' });

export default wsClient;

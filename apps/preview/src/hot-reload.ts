import type { Server as HttpServer } from 'http';

import { WebSocketServer, WebSocket } from 'ws';

export type ReloadMode = 'full-reload' | 'hot-update';
export type BuildStatus = 'idle' | 'building' | 'ready' | 'failed';

export interface ReloadEvent {
  type: 'reload';
  mode: ReloadMode;
  projectId: string | null;
  changedFiles: string[];
  buildStatus: BuildStatus;
  timestamp: number;
}

export interface BuildStatusEvent {
  type: 'build-status';
  projectId: string;
  status: BuildStatus;
  message: string | null;
  timestamp: number;
}

export interface BuildLogEvent {
  type: 'build-log';
  projectId: string;
  stream: 'stdout' | 'stderr';
  line: string;
  timestamp: number;
}

export interface ErrorEvent {
  type: 'runtime-error';
  projectId: string;
  message: string;
  stack: string | null;
  filename: string | null;
  line: number | null;
  column: number | null;
  timestamp: number;
}

export type PreviewEvent = ReloadEvent | BuildStatusEvent | BuildLogEvent | ErrorEvent;

/**
 * Determines the reload mode based on file extensions.
 * CSS-only changes can use hot-update, everything else needs full-reload.
 */
export function determineReloadMode(changedFiles: string[]): ReloadMode {
  if (changedFiles.length === 0) return 'full-reload';

  const allCssOnly = changedFiles.every(
    (f) => f.endsWith('.css') || f.endsWith('.scss') || f.endsWith('.less'),
  );

  return allCssOnly ? 'hot-update' : 'full-reload';
}

/**
 * Manages WebSocket connections for hot-reload notifications.
 * Clients connect to ws://host/ws and receive reload signals
 * when project files change.
 */
export class HotReloadManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private buildStatuses = new Map<string, BuildStatus>();
  private rebuildHandler: ((projectId: string) => Promise<void>) | null = null;

  /**
   * Attach the WebSocket server to an existing HTTP server.
   * Handles upgrade requests for the /ws path.
   */
  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;

      if (pathname === '/ws') {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Set a handler that triggers a rebuild when notify is received.
   */
  setRebuildHandler(handler: (projectId: string) => Promise<void>): void {
    this.rebuildHandler = handler;
  }

  /**
   * Broadcast a reload signal to all connected clients.
   * Optionally scoped to a specific project.
   * If a rebuild handler is set and auto-rebuild is enabled, triggers a rebuild.
   */
  broadcastReload(projectId?: string, changedFiles?: string[]): void {
    const files = changedFiles || [];
    const mode = determineReloadMode(files);
    const currentStatus = this.buildStatuses.get(projectId || '') || 'idle';

    const message = JSON.stringify({
      type: 'reload',
      mode,
      projectId: projectId || null,
      changedFiles: files,
      buildStatus: currentStatus,
      timestamp: Date.now(),
    } satisfies ReloadEvent);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }

    // Trigger auto-rebuild if handler is set
    if (projectId && this.rebuildHandler) {
      this.rebuildHandler(projectId).catch(() => {
        // Rebuild errors are handled by the build status events
      });
    }
  }

  /**
   * Broadcast a build status change event.
   */
  broadcastBuildStatus(projectId: string, status: BuildStatus, message?: string): void {
    this.buildStatuses.set(projectId, status);

    const event = JSON.stringify({
      type: 'build-status',
      projectId,
      status,
      message: message || null,
      timestamp: Date.now(),
    } satisfies BuildStatusEvent);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(event);
      }
    }
  }

  /**
   * Broadcast a build log line.
   */
  broadcastBuildLog(projectId: string, stream: 'stdout' | 'stderr', line: string): void {
    const event = JSON.stringify({
      type: 'build-log',
      projectId,
      stream,
      line,
      timestamp: Date.now(),
    } satisfies BuildLogEvent);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(event);
      }
    }
  }

  /**
   * Broadcast a runtime error event.
   */
  broadcastError(projectId: string, error: { message: string; stack: string | null; filename: string | null; line: number | null; column: number | null }): void {
    const event = JSON.stringify({
      type: 'runtime-error',
      projectId,
      ...error,
      timestamp: Date.now(),
    } satisfies ErrorEvent);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(event);
      }
    }
  }

  /**
   * Get the build status for a project.
   */
  getBuildStatus(projectId: string): BuildStatus {
    return this.buildStatuses.get(projectId) || 'idle';
  }

  /**
   * Get the number of currently connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections and shut down the WebSocket server.
   */
  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss?.close();
  }
}

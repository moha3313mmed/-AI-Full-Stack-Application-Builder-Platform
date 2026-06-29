import http from 'http';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';

import { HotReloadManager } from '../hot-reload';

describe('HotReloadManager', () => {
  let manager: HotReloadManager;
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    manager = new HotReloadManager();
    server = http.createServer();
    manager.attach(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    manager.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should accept WebSocket connections on /ws path', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    expect(manager.getClientCount()).toBe(1);
    ws.close();
  });

  it('should reject WebSocket connections on other paths', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/other`);

    await new Promise<void>((resolve) => {
      ws.on('error', () => resolve());
      ws.on('close', () => resolve());
    });

    expect(manager.getClientCount()).toBe(0);
  });

  it('should broadcast reload messages to connected clients', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    const messagePromise = new Promise<string>((resolve) => {
      ws.on('message', (data) => resolve(data.toString()));
    });

    manager.broadcastReload('test-project');

    const message = await messagePromise;
    const parsed = JSON.parse(message);

    expect(parsed.type).toBe('reload');
    expect(parsed.projectId).toBe('test-project');
    expect(parsed.timestamp).toBeTypeOf('number');

    ws.close();
  });

  it('should remove clients on disconnect', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    expect(manager.getClientCount()).toBe(1);

    ws.close();

    // Wait for close event to propagate
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(manager.getClientCount()).toBe(0);
  });

  it('should handle multiple clients', async () => {
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    const ws2 = new WebSocket(`ws://localhost:${port}/ws`);

    await Promise.all([
      new Promise<void>((resolve) => ws1.on('open', () => resolve())),
      new Promise<void>((resolve) => ws2.on('open', () => resolve())),
    ]);

    expect(manager.getClientCount()).toBe(2);

    const messages: string[] = [];
    ws1.on('message', (data) => messages.push(data.toString()));
    ws2.on('message', (data) => messages.push(data.toString()));

    manager.broadcastReload('project-123');

    // Wait for messages to arrive
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(messages.length).toBe(2);
    expect(JSON.parse(messages[0]).type).toBe('reload');
    expect(JSON.parse(messages[1]).type).toBe('reload');

    ws1.close();
    ws2.close();
  });

  it('should broadcast with null projectId when none specified', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    const messagePromise = new Promise<string>((resolve) => {
      ws.on('message', (data) => resolve(data.toString()));
    });

    manager.broadcastReload();

    const message = await messagePromise;
    const parsed = JSON.parse(message);

    expect(parsed.type).toBe('reload');
    expect(parsed.projectId).toBeNull();

    ws.close();
  });
});

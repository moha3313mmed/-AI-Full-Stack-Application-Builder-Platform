import http from 'http';

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import { createApp, type PreviewApp } from '../server';

describe('Preview Server', () => {
  let previewApp: PreviewApp;
  let previewPort: number;
  // Fake API server to simulate the NestJS API
  let apiServer: http.Server;
  let apiPort: number;
  // Store the file responses the fake API should return
  let apiResponses: Map<string, { status: number; body: string }>;

  beforeAll(async () => {
    // Start a fake API server
    apiResponses = new Map();
    apiServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${apiPort}`);
      const key = url.pathname + url.search;

      // Check for matching response by projectId and path
      for (const [pattern, response] of apiResponses) {
        if (key.includes(pattern)) {
          res.writeHead(response.status, { 'Content-Type': 'application/json' });
          res.end(response.body);
          return;
        }
      }

      // Default 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not Found' }));
    });

    await new Promise<void>((resolve) => {
      apiServer.listen(0, () => {
        apiPort = (apiServer.address() as { port: number }).port;
        // Set the API_BASE_URL env for the preview server to use our fake API
        process.env.API_BASE_URL = `http://localhost:${apiPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    delete process.env.API_BASE_URL;
    await new Promise<void>((resolve) => {
      apiServer.close(() => resolve());
    });
  });

  beforeEach(async () => {
    apiResponses.clear();
    previewApp = createApp();

    await new Promise<void>((resolve) => {
      previewApp.server.listen(0, () => {
        previewPort = (previewApp.server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    previewApp.hotReload.close();
    await new Promise<void>((resolve) => {
      previewApp.server.close(() => resolve());
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await fetch(`http://localhost:${previewPort}/health`);
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('preview-server');
    });
  });

  describe('POST /preview/:projectId/notify', () => {
    it('should return notified status', async () => {
      const response = await fetch(`http://localhost:${previewPort}/preview/test-project/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body.notified).toBe(true);
      expect(body.clients).toBe(0);
    });

    it('should reject requests without token when PREVIEW_NOTIFY_TOKEN is set', async () => {
      process.env.PREVIEW_NOTIFY_TOKEN = 'secret-token';

      // Recreate the app with the token set
      previewApp.hotReload.close();
      await new Promise<void>((resolve) => {
        previewApp.server.close(() => resolve());
      });

      previewApp = createApp();
      await new Promise<void>((resolve) => {
        previewApp.server.listen(0, () => {
          previewPort = (previewApp.server.address() as { port: number }).port;
          resolve();
        });
      });

      const response = await fetch(`http://localhost:${previewPort}/preview/test-project/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(401);
      expect(body.error).toContain('Unauthorized');

      delete process.env.PREVIEW_NOTIFY_TOKEN;
    });

    it('should accept requests with valid Bearer token when PREVIEW_NOTIFY_TOKEN is set', async () => {
      process.env.PREVIEW_NOTIFY_TOKEN = 'secret-token';

      // Recreate the app with the token set
      previewApp.hotReload.close();
      await new Promise<void>((resolve) => {
        previewApp.server.close(() => resolve());
      });

      previewApp = createApp();
      await new Promise<void>((resolve) => {
        previewApp.server.listen(0, () => {
          previewPort = (previewApp.server.address() as { port: number }).port;
          resolve();
        });
      });

      const response = await fetch(`http://localhost:${previewPort}/preview/test-project/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-token',
        },
        body: JSON.stringify({}),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body.notified).toBe(true);

      delete process.env.PREVIEW_NOTIFY_TOKEN;
    });
  });

  describe('GET /preview/:projectId/*', () => {
    it('should return 404 for missing files', async () => {
      // The fake API returns 404 by default for unknown paths
      const response = await fetch(`http://localhost:${previewPort}/preview/test-project/missing.html`);
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(404);
      expect(body.error).toBe('File not found');
      expect(body.path).toBe('/missing.html');
    });

    it('should serve HTML files with hot-reload script injected', async () => {
      const htmlContent = '<html><body><h1>Hello</h1></body></html>';

      apiResponses.set('test-project/files/read', {
        status: 200,
        body: JSON.stringify({ content: htmlContent, language: 'html', path: '/index.html' }),
      });

      const response = await fetch(`http://localhost:${previewPort}/preview/test-project/index.html`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(body).toContain('<h1>Hello</h1>');
      expect(body).toContain('data-preview-hot-reload');
      expect(body).toContain('WebSocket');
    });

    it('should serve CSS files with correct MIME type and no injection', async () => {
      const cssContent = 'body { color: red; }';

      apiResponses.set('test-project/files/read', {
        status: 200,
        body: JSON.stringify({ content: cssContent, language: 'css', path: '/style.css' }),
      });

      const response = await fetch(`http://localhost:${previewPort}/preview/test-project/style.css`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/css');
      expect(body).toBe(cssContent);
      expect(body).not.toContain('data-preview-hot-reload');
    });

    it('should serve JavaScript files with correct MIME type', async () => {
      const jsContent = 'console.log("hello");';

      apiResponses.set('test-project/files/read', {
        status: 200,
        body: JSON.stringify({ content: jsContent, language: 'javascript', path: '/app.js' }),
      });

      const response = await fetch(`http://localhost:${previewPort}/preview/test-project/app.js`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('javascript');
      expect(body).toBe(jsContent);
    });

    it('should default to index.html when no file path specified', async () => {
      const htmlContent = '<html><body>Index</body></html>';

      apiResponses.set('path=%2Findex.html', {
        status: 200,
        body: JSON.stringify({ content: htmlContent, language: 'html', path: '/index.html' }),
      });

      const response = await fetch(`http://localhost:${previewPort}/preview/test-project`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('Index');
    });

    it('should return 502 when API is unreachable', async () => {
      // Point to a port that nothing is listening on
      const originalUrl = process.env.API_BASE_URL;
      process.env.API_BASE_URL = 'http://localhost:1';

      // Recreate the app with the bad URL
      previewApp.hotReload.close();
      await new Promise<void>((resolve) => {
        previewApp.server.close(() => resolve());
      });

      previewApp = createApp();
      await new Promise<void>((resolve) => {
        previewApp.server.listen(0, () => {
          previewPort = (previewApp.server.address() as { port: number }).port;
          resolve();
        });
      });

      const response = await fetch(`http://localhost:${previewPort}/preview/test-project/index.html`);
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(502);
      expect(body.error).toBe('Failed to fetch file from API');

      // Restore
      process.env.API_BASE_URL = originalUrl;
    });
  });

  describe('MIME type resolution', () => {
    const testCases = [
      { file: 'image.png', expectedType: 'image/png' },
      { file: 'data.json', expectedType: 'application/json' },
      { file: 'font.woff2', expectedType: 'font/woff2' },
      { file: 'icon.svg', expectedType: 'image/svg+xml' },
    ];

    for (const { file, expectedType } of testCases) {
      it(`should resolve ${file} to ${expectedType}`, async () => {
        apiResponses.set('test-project/files/read', {
          status: 200,
          body: JSON.stringify({ content: 'file-content', language: 'plaintext', path: `/${file}` }),
        });

        const response = await fetch(`http://localhost:${previewPort}/preview/test-project/${file}`);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain(expectedType);
      });
    }
  });
});

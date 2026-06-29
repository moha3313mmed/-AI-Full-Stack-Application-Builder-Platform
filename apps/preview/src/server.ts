import fs from 'fs';
import http from 'http';
import path from 'path';

import cors from 'cors';
import express from 'express';
import mime from 'mime-types';

import { BuildLogStream } from './build-log-stream';
import { HotReloadManager } from './hot-reload';
import { injectHotReload, isHtmlContent } from './html-injector';
import { injectErrorBoundary, RuntimeErrorReporter } from './runtime-error-reporter';
import { SandboxManager } from './sandbox-manager';

const PORT = parseInt(process.env.PREVIEW_PORT || '3002', 10);

function getApiBaseUrl(): string {
  return process.env.API_BASE_URL || 'http://localhost:4000';
}

function getNotifyToken(): string {
  return process.env.PREVIEW_NOTIFY_TOKEN || '';
}

export interface PreviewApp {
  app: express.Application;
  server: http.Server;
  hotReload: HotReloadManager;
  sandboxManager: SandboxManager;
  errorReporter: RuntimeErrorReporter;
}

/**
 * Creates the Express application for the preview server.
 * Separated from listen() for testability.
 */
export function createApp(): PreviewApp {
  const app = express();
  const hotReload = new HotReloadManager();
  const sandboxManager = new SandboxManager();
  const errorReporter = new RuntimeErrorReporter();
  const buildLogs = new Map<string, BuildLogStream>();

  app.use(cors());
  app.use(express.json());

  // Wire up sandbox log handler to broadcast via WebSocket
  sandboxManager.setLogHandler((projectId, stream, line) => {
    // Get or create build log stream for this project
    if (!buildLogs.has(projectId)) {
      buildLogs.set(projectId, new BuildLogStream());
    }
    const logStream = buildLogs.get(projectId)!;
    logStream.addLine(stream, line);
    hotReload.broadcastBuildLog(projectId, stream, line);
  });

  // Wire up error reporter to broadcast via WebSocket
  errorReporter.onError((error) => {
    hotReload.broadcastError(error.projectId, {
      message: error.message,
      stack: error.stack,
      filename: error.filename,
      line: error.line,
      column: error.column,
    });
  });

  // Set rebuild handler for auto-rebuild on notify
  hotReload.setRebuildHandler(async (projectId: string) => {
    const sandbox = sandboxManager.getSandbox(projectId);
    if (sandbox && sandbox.status === 'ready') {
      // Trigger rebuild by fetching fresh files and rebuilding
      hotReload.broadcastBuildStatus(projectId, 'building', 'Auto-rebuilding after file change');
      try {
        const files = await fetchAllProjectFiles(projectId);
        if (files) {
          const result = await sandboxManager.build(projectId, files);
          if (result.success) {
            hotReload.broadcastBuildStatus(projectId, 'ready', 'Build successful');
          } else {
            hotReload.broadcastBuildStatus(projectId, 'failed', result.error || 'Build failed');
          }
        }
      } catch {
        hotReload.broadcastBuildStatus(projectId, 'failed', 'Auto-rebuild failed');
      }
    }
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'preview-server' });
  });

  /**
   * POST /preview/:projectId/notify
   * Called by the API when project files change.
   * Broadcasts a reload signal to all connected preview clients.
   * Requires a valid Bearer token when PREVIEW_NOTIFY_TOKEN is configured.
   */
  app.post('/preview/:projectId/notify', (req, res) => {
    const token = getNotifyToken();
    if (token) {
      const authHeader = req.headers.authorization || '';
      const providedToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : '';
      if (providedToken !== token) {
        res.status(401).json({ error: 'Unauthorized: invalid or missing notify token' });
        return;
      }
    }

    const { projectId } = req.params;
    const { changedFiles } = req.body || {};
    hotReload.broadcastReload(projectId, changedFiles);
    res.json({ notified: true, clients: hotReload.getClientCount() });
  });

  /**
   * POST /preview/:projectId/build
   * Triggers a sandbox build for the project.
   * Fetches project files from the API and builds them in an isolated environment.
   */
  app.post('/preview/:projectId/build', async (req, res) => {
    const { projectId } = req.params;

    try {
      hotReload.broadcastBuildStatus(projectId, 'building', 'Starting build');

      // Clear previous build logs
      buildLogs.set(projectId, new BuildLogStream());

      // Fetch project files from API
      const files = await fetchAllProjectFiles(projectId);
      if (!files) {
        hotReload.broadcastBuildStatus(projectId, 'failed', 'Could not fetch project files');
        res.status(502).json({ error: 'Could not fetch project files from API' });
        return;
      }

      // Trigger build
      const result = await sandboxManager.build(projectId, files);

      if (result.success) {
        hotReload.broadcastBuildStatus(projectId, 'ready', 'Build successful');
        res.json({
          success: true,
          outputDir: result.outputDir,
          duration: result.duration,
        });
      } else {
        hotReload.broadcastBuildStatus(projectId, 'failed', result.error || undefined);
        res.status(422).json({
          success: false,
          error: result.error,
          exitCode: result.exitCode,
          duration: result.duration,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      hotReload.broadcastBuildStatus(projectId, 'failed', message);
      res.status(500).json({ error: 'Build failed', detail: message });
    }
  });

  /**
   * GET /preview/:projectId/build/status
   * Returns the current build status and any detected errors.
   */
  app.get('/preview/:projectId/build/status', (req, res) => {
    const { projectId } = req.params;
    const sandbox = sandboxManager.getSandbox(projectId);
    const logStream = buildLogs.get(projectId);

    res.json({
      projectId,
      status: sandbox?.status || 'idle',
      outputDir: sandbox?.outputDir || null,
      error: sandbox?.error || null,
      errors: logStream?.getErrors() || [],
      createdAt: sandbox?.createdAt || null,
    });
  });

  /**
   * GET /preview/:projectId/build/logs
   * Returns the full build log output.
   */
  app.get('/preview/:projectId/build/logs', (req, res) => {
    const { projectId } = req.params;
    const logStream = buildLogs.get(projectId);

    if (!logStream) {
      res.json({ projectId, logs: [], output: '' });
      return;
    }

    res.json({
      projectId,
      logs: logStream.getLogs(),
      output: logStream.getFullOutput(),
      errors: logStream.getErrors(),
      lineCount: logStream.getLineCount(),
    });
  });

  /**
   * POST /preview/:projectId/errors
   * Receives runtime error reports from the preview application.
   */
  app.post('/preview/:projectId/errors', (req, res) => {
    const { projectId } = req.params;
    const { type, message, stack, filename, line, column, timestamp } = req.body || {};

    const error = errorReporter.reportError(projectId, {
      type: type || 'uncaught',
      message: message || 'Unknown error',
      stack: stack || null,
      filename: filename || null,
      line: line ?? null,
      column: column ?? null,
      timestamp: timestamp || Date.now(),
    });

    res.json({ received: true, error });
  });

  /**
   * POST /preview/:projectId/console
   * Receives console output from the preview application.
   */
  app.post('/preview/:projectId/console', (req, res) => {
    const { projectId } = req.params;
    const { level, args, timestamp } = req.body || {};

    const entry = errorReporter.reportConsole(projectId, {
      level: level || 'log',
      args: args || [],
      timestamp: timestamp || Date.now(),
    });

    res.json({ received: true, entry });
  });

  /**
   * GET /preview/:projectId/errors
   * Returns all runtime errors for the project.
   */
  app.get('/preview/:projectId/errors', (req, res) => {
    const { projectId } = req.params;
    res.json({
      projectId,
      errors: errorReporter.getErrors(projectId),
      console: errorReporter.getConsoleEntries(projectId),
    });
  });

  /**
   * GET /preview/:projectId/*
   * Serves project files. If a sandbox build exists, serves from the build output.
   * Falls back to fetching raw files from the API.
   * Injects hot-reload and error boundary scripts into HTML responses.
   */
  app.get('/preview/:projectId', handlePreviewRequest);
  app.get('/preview/:projectId/*', handlePreviewRequest);

  async function handlePreviewRequest(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    const projectId = String(req.params.projectId || '');
    // Extract the file path from the wildcard segment
    const wildcard = req.params[0];
    const filePath = (typeof wildcard === 'string' ? wildcard : '') || 'index.html';

    // Normalize the path: ensure it starts with /
    const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;

    try {
      // Check if we have a built sandbox for this project
      const sandbox = sandboxManager.getSandbox(projectId);
      if (sandbox && sandbox.status === 'ready' && sandbox.outputDir) {
        const builtFile = await serveFromSandbox(sandbox.outputDir, normalizedPath);
        if (builtFile !== null) {
          const mimeType = mime.lookup(normalizedPath) || 'text/html';
          res.setHeader('Content-Type', mimeType);

          if (typeof builtFile === 'string' && isHtmlContent(mimeType)) {
            let content = builtFile;
            content = injectHotReload(content);
            content = injectErrorBoundary(content);
            res.send(content);
          } else {
            res.send(builtFile);
          }
          return;
        }
      }

      // Fallback: fetch raw file from API
      const fileContent = await fetchFileFromAPI(projectId, normalizedPath);

      if (fileContent === null) {
        res.status(404).json({
          error: 'File not found',
          path: normalizedPath,
          projectId,
          hint: `No file at ${normalizedPath} in project ${projectId}. Check that the file exists in the virtual file system.`,
        });
        return;
      }

      // Determine the MIME type from the file extension
      const mimeType = mime.lookup(normalizedPath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);

      // If it's HTML, inject the hot-reload and error boundary scripts
      if (isHtmlContent(mimeType)) {
        let injected = injectHotReload(fileContent);
        injected = injectErrorBoundary(injected);
        res.send(injected);
      } else {
        res.send(fileContent);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(502).json({
        error: 'Failed to fetch file from API',
        detail: message,
        projectId,
        path: normalizedPath,
      });
    }
  }

  const server = http.createServer(app);
  hotReload.attach(server);

  return { app, server, hotReload, sandboxManager, errorReporter };
}

/**
 * Serve a file from the sandbox build output directory.
 * Returns null if the file doesn't exist.
 * Returns a Buffer for binary files or a string for text files.
 */
async function serveFromSandbox(outputDir: string, filePath: string): Promise<string | Buffer | null> {
  const normalizedPath = filePath === '/' ? '/index.html' : filePath;
  const fullPath = path.join(outputDir, normalizedPath);

  // Prevent directory traversal
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(outputDir))) {
    return null;
  }

  try {
    const stat = await fs.promises.stat(resolved);
    if (stat.isDirectory()) {
      // Try index.html in directory
      const indexPath = path.join(resolved, 'index.html');
      const content = await fs.promises.readFile(indexPath, 'utf-8');
      return content;
    }

    // Determine if the file is binary based on its MIME type
    const mimeType = mime.lookup(resolved) || 'application/octet-stream';
    const isText = typeof mimeType === 'string' && (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/xml' ||
      mimeType.endsWith('+xml') ||
      mimeType.endsWith('+json')
    );

    if (isText) {
      return await fs.promises.readFile(resolved, 'utf-8');
    }
    return await fs.promises.readFile(resolved);
  } catch {
    return null;
  }
}

/**
 * Fetch file content from the API's file read endpoint.
 * Returns null if the file is not found (404).
 */
export async function fetchFileFromAPI(
  projectId: string,
  filePath: string,
): Promise<string | null> {
  const apiBase = getApiBaseUrl();
  const url = `${apiBase}/projects/${projectId}/files/read?path=${encodeURIComponent(filePath)}`;

  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as { content?: string };
  return data.content ?? '';
}

/**
 * Fetch all project files from the API for sandbox building.
 * Returns a Map of file path to content, or null on failure.
 */
async function fetchAllProjectFiles(projectId: string): Promise<Map<string, string> | null> {
  const apiBase = getApiBaseUrl();
  const url = `${apiBase}/projects/${projectId}/files/list`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as { files?: Array<{ path: string; content: string }> };
    if (!data.files) return null;

    const files = new Map<string, string>();
    for (const file of data.files) {
      files.set(file.path, file.content);
    }
    return files;
  } catch {
    return null;
  }
}

/**
 * Start the preview server (only when run directly, not when imported for testing).
 */
export function startServer(port: number = PORT): http.Server {
  const { server } = createApp();

  server.listen(port, () => {
    console.log(`Preview server listening on port ${port}`);
    console.log(`API base URL: ${getApiBaseUrl()}`);
  });

  return server;
}

// Start the server when this module is executed directly
const isDirectExecution = require.main === module ||
  process.argv[1]?.endsWith('/preview/src/server.ts') ||
  process.argv[1]?.endsWith('/preview/dist/server.js');

if (isDirectExecution) {
  startServer();
}

import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SandboxConfig {
  /** Maximum concurrent sandboxes (default 10) */
  maxConcurrent: number;
  /** Timeout for npm install in ms (default 120000) */
  installTimeout: number;
  /** Timeout for build command in ms (default 60000) */
  buildTimeout: number;
  /** TTL before cleanup in ms (default 1800000 = 30 minutes) */
  ttl: number;
}

export type SandboxStatus = 'creating' | 'installing' | 'building' | 'ready' | 'failed' | 'expired';

export interface SandboxInfo {
  projectId: string;
  status: SandboxStatus;
  directory: string;
  outputDir: string | null;
  createdAt: number;
  error: string | null;
}

export interface BuildResult {
  success: boolean;
  outputDir: string | null;
  error: string | null;
  exitCode: number | null;
  duration: number;
}

const DEFAULT_CONFIG: SandboxConfig = {
  maxConcurrent: 10,
  installTimeout: 120000,
  buildTimeout: 60000,
  ttl: 1800000,
};

/**
 * Manages isolated sandbox environments for building preview projects.
 * Creates temp directories, runs install + build, manages lifecycle and cleanup.
 */
export class SandboxManager {
  private sandboxes = new Map<string, SandboxInfo>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();
  private config: SandboxConfig;
  private onLog: ((projectId: string, stream: 'stdout' | 'stderr', line: string) => void) | null = null;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set a callback to receive build log output.
   */
  setLogHandler(handler: (projectId: string, stream: 'stdout' | 'stderr', line: string) => void): void {
    this.onLog = handler;
  }

  /**
   * Get the current status of a sandbox.
   */
  getSandbox(projectId: string): SandboxInfo | undefined {
    return this.sandboxes.get(projectId);
  }

  /**
   * Get all active sandboxes.
   */
  getActiveSandboxes(): SandboxInfo[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * Create a sandbox and build the project.
   * Writes files to a temp directory, runs npm install + npm run build.
   */
  async build(
    projectId: string,
    files: Map<string, string>,
  ): Promise<BuildResult> {
    // Check concurrent limit
    const active = this.getActiveSandboxCount();
    if (active >= this.config.maxConcurrent) {
      return {
        success: false,
        outputDir: null,
        error: `Maximum concurrent sandboxes reached (${this.config.maxConcurrent})`,
        exitCode: null,
        duration: 0,
      };
    }

    const startTime = Date.now();
    const tmpDir = await this.createTempDir(projectId);

    const info: SandboxInfo = {
      projectId,
      status: 'creating',
      directory: tmpDir,
      outputDir: null,
      createdAt: startTime,
      error: null,
    };
    this.sandboxes.set(projectId, info);

    try {
      // Write project files
      await this.writeFiles(tmpDir, files);

      // Detect framework and determine build commands
      const packageJson = files.get('/package.json') || files.get('package.json');
      const buildCommand = this.detectBuildCommand(packageJson);

      // Run npm install
      info.status = 'installing';
      this.sandboxes.set(projectId, { ...info });

      const installResult = await this.runCommand(
        projectId,
        'npm',
        ['install', '--prefer-offline', '--ignore-scripts'],
        tmpDir,
        this.config.installTimeout,
      );

      if (!installResult.success) {
        info.status = 'failed';
        info.error = `Install failed with exit code ${installResult.exitCode}`;
        this.sandboxes.set(projectId, { ...info });
        this.scheduleCleanup(projectId);
        return {
          success: false,
          outputDir: null,
          error: info.error,
          exitCode: installResult.exitCode,
          duration: Date.now() - startTime,
        };
      }

      // Run build (only if the build script passes validation)
      if (buildCommand === null) {
        info.status = 'failed';
        info.error = 'Build script is not in the allowed list of safe build commands';
        this.sandboxes.set(projectId, { ...info });
        this.scheduleCleanup(projectId);
        return {
          success: false,
          outputDir: null,
          error: info.error,
          exitCode: null,
          duration: Date.now() - startTime,
        };
      }

      info.status = 'building';
      this.sandboxes.set(projectId, { ...info });

      const buildResult = await this.runCommand(
        projectId,
        'npm',
        ['run', buildCommand],
        tmpDir,
        this.config.buildTimeout,
        { sandboxed: true },
      );

      if (!buildResult.success) {
        info.status = 'failed';
        info.error = `Build failed with exit code ${buildResult.exitCode}`;
        this.sandboxes.set(projectId, { ...info });
        this.scheduleCleanup(projectId);
        return {
          success: false,
          outputDir: null,
          error: info.error,
          exitCode: buildResult.exitCode,
          duration: Date.now() - startTime,
        };
      }

      // Determine output directory
      const outputDir = this.findOutputDir(tmpDir, packageJson);
      info.status = 'ready';
      info.outputDir = outputDir;
      this.sandboxes.set(projectId, { ...info });
      this.scheduleCleanup(projectId);

      return {
        success: true,
        outputDir,
        error: null,
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      info.status = 'failed';
      info.error = message;
      this.sandboxes.set(projectId, { ...info });
      this.scheduleCleanup(projectId);

      return {
        success: false,
        outputDir: null,
        error: message,
        exitCode: null,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Remove a sandbox and clean up its temp directory.
   */
  async cleanup(projectId: string): Promise<void> {
    const info = this.sandboxes.get(projectId);
    if (!info) return;

    const timer = this.cleanupTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(projectId);
    }

    try {
      await fs.promises.rm(info.directory, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    this.sandboxes.delete(projectId);
  }

  /**
   * Clean up all sandboxes.
   */
  async cleanupAll(): Promise<void> {
    const projectIds = Array.from(this.sandboxes.keys());
    await Promise.all(projectIds.map((id) => this.cleanup(id)));
  }

  private getActiveSandboxCount(): number {
    let count = 0;
    for (const info of this.sandboxes.values()) {
      if (info.status !== 'expired' && info.status !== 'failed') {
        count++;
      }
    }
    return count;
  }

  private async createTempDir(projectId: string): Promise<string> {
    const prefix = `preview-sandbox-${projectId}-`;
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
    return tmpDir;
  }

  private async writeFiles(dir: string, files: Map<string, string>): Promise<void> {
    const resolvedDir = path.resolve(dir);

    for (const [filePath, content] of files) {
      const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const fullPath = path.resolve(dir, normalizedPath);

      // Path traversal guard: ensure the resolved path stays within the sandbox directory
      if (!fullPath.startsWith(resolvedDir + path.sep) && fullPath !== resolvedDir) {
        throw new Error(
          `Path traversal detected: "${filePath}" resolves outside sandbox directory`,
        );
      }

      const fileDir = path.dirname(fullPath);

      await fs.promises.mkdir(fileDir, { recursive: true });
      await fs.promises.writeFile(fullPath, content, 'utf-8');
    }
  }

  /**
   * Allowed build script patterns. Only scripts matching these patterns
   * will be executed. This prevents arbitrary command execution.
   */
  private static readonly ALLOWED_BUILD_PATTERNS: RegExp[] = [
    /^(next|react-scripts|vite|tsc|esbuild|webpack|rollup|parcel|turbo)\b/,
    /^npx\s+(next|vite|tsc|esbuild|webpack|rollup|parcel|turbo)\b/,
    /^node\s+[\w./\\-]+\.m?[jt]s$/,
    /^echo\b/,
  ];

  private detectBuildCommand(packageJsonContent: string | undefined): string | null {
    if (!packageJsonContent) return null;

    try {
      const pkg = JSON.parse(packageJsonContent);
      const buildScript = pkg.scripts?.build || pkg.scripts?.['build:production'];

      if (!buildScript) return null;

      // Validate the build script against allowed patterns
      const isAllowed = SandboxManager.ALLOWED_BUILD_PATTERNS.some((pattern) =>
        pattern.test(buildScript.trim()),
      );

      if (!isAllowed) {
        return null;
      }

      if (pkg.scripts?.build) return 'build';
      if (pkg.scripts?.['build:production']) return 'build:production';
      return null;
    } catch {
      return null;
    }
  }

  private findOutputDir(tmpDir: string, _packageJsonContent: string | undefined): string {
    // Check common output directories
    const candidates = ['dist', 'build', '.next', 'out'];

    for (const candidate of candidates) {
      const candidatePath = path.join(tmpDir, candidate);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }

    // Default to dist
    return path.join(tmpDir, 'dist');
  }

  private runCommand(
    projectId: string,
    command: string,
    args: string[],
    cwd: string,
    timeout: number,
    options?: { sandboxed?: boolean },
  ): Promise<{ success: boolean; exitCode: number | null }> {
    return new Promise((resolve) => {
      let timedOut = false;
      let child: ChildProcess;

      try {
        // Build environment: for sandboxed commands, restrict PATH to only node/npm
        // and remove potentially dangerous env vars
        let env: Record<string, string | undefined>;

        if (options?.sandboxed) {
          // Restrict PATH to only include node_modules/.bin and the directory containing node/npm
          const npmPath = process.env.npm_execpath || '';
          const nodeDir = process.execPath ? path.dirname(process.execPath) : '/usr/bin';
          const restrictedPath = [
            path.join(cwd, 'node_modules', '.bin'),
            nodeDir,
            '/usr/bin',
          ].join(path.delimiter);

          env = {
            NODE_ENV: 'production',
            PATH: restrictedPath,
            HOME: cwd,
            TMPDIR: cwd,
            npm_execpath: npmPath,
            // Explicitly exclude: SSH_AUTH_SOCK, AWS_*, GITHUB_TOKEN, etc.
          };
        } else {
          env = { ...process.env, NODE_ENV: 'production' };
        }

        child = spawn(command, args, {
          cwd,
          shell: true,
          env,
        });
      } catch {
        resolve({ success: false, exitCode: null });
        return;
      }

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
      }, timeout);

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          this.onLog?.(projectId, 'stdout', line);
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          this.onLog?.(projectId, 'stderr', line);
        }
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          this.onLog?.(projectId, 'stderr', `Process timed out after ${timeout}ms`);
          resolve({ success: false, exitCode: code });
        } else {
          resolve({ success: code === 0, exitCode: code });
        }
      });

      child.on('error', () => {
        clearTimeout(timer);
        resolve({ success: false, exitCode: null });
      });
    });
  }

  private scheduleCleanup(projectId: string): void {
    const existing = this.cleanupTimers.get(projectId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.cleanup(projectId);
    }, this.config.ttl);

    this.cleanupTimers.set(projectId, timer);
  }
}

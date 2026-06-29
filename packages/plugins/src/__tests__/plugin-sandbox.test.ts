import { describe, it, expect, beforeEach } from 'vitest';

import { PermissionGuard, PermissionDeniedError } from '../sandbox/permission-guard.js';
import { PluginSandbox } from '../sandbox/plugin-sandbox.js';
import {
  PluginCategory,
  PluginHook,
  PluginManifest,
  PluginPermission,
} from '../types/index.js';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  beforeEach(() => {
    guard = new PermissionGuard();
  });

  it('should allow an operation when the plugin has the required permission', () => {
    guard.registerPlugin('plugin-1', [PluginPermission.READ_FILES]);
    expect(() => guard.checkPermission('plugin-1', PluginPermission.READ_FILES, 'readFile')).not.toThrow();
  });

  it('should throw PermissionDeniedError when the plugin does not have the permission', () => {
    guard.registerPlugin('plugin-1', [PluginPermission.READ_FILES]);
    expect(() => guard.checkPermission('plugin-1', PluginPermission.WRITE_FILES, 'writeFile')).toThrow(PermissionDeniedError);
  });

  it('should throw PermissionDeniedError for unregistered plugin', () => {
    expect(() => guard.checkPermission('unknown', PluginPermission.READ_FILES, 'readFile')).toThrow(PermissionDeniedError);
  });

  it('should check hasPermission without throwing', () => {
    guard.registerPlugin('plugin-1', [PluginPermission.NETWORK]);
    expect(guard.hasPermission('plugin-1', PluginPermission.NETWORK)).toBe(true);
    expect(guard.hasPermission('plugin-1', PluginPermission.DEPLOY)).toBe(false);
  });

  it('should return false for hasPermission on unregistered plugin', () => {
    expect(guard.hasPermission('unknown', PluginPermission.READ_FILES)).toBe(false);
  });

  it('should unregister a plugin', () => {
    guard.registerPlugin('plugin-1', [PluginPermission.READ_FILES]);
    guard.unregisterPlugin('plugin-1');
    expect(guard.hasPermission('plugin-1', PluginPermission.READ_FILES)).toBe(false);
  });

  it('should get all permissions for a plugin', () => {
    guard.registerPlugin('plugin-1', [PluginPermission.READ_FILES, PluginPermission.WRITE_FILES]);
    const perms = guard.getPermissions('plugin-1');
    expect(perms).toContain(PluginPermission.READ_FILES);
    expect(perms).toContain(PluginPermission.WRITE_FILES);
  });

  it('should return empty array for unknown plugin permissions', () => {
    expect(guard.getPermissions('unknown')).toEqual([]);
  });
});

describe('PluginSandbox', () => {
  let sandbox: PluginSandbox;
  let guard: PermissionGuard;

  const createManifest = (permissions: PluginPermission[]): PluginManifest => ({
    id: 'sandbox-plugin',
    name: 'Sandbox Plugin',
    version: '1.0.0',
    author: 'Test',
    description: 'Testing sandbox',
    keywords: ['test'],
    category: PluginCategory.TOOLING,
    permissions,
    entry: './dist/index.js',
    hooks: [PluginHook.ON_INSTALL],
    dependencies: {},
    engines: { builder: '>=1.0.0' },
  });

  beforeEach(() => {
    guard = new PermissionGuard();
    sandbox = new PluginSandbox(guard);
  });

  it('should allow readFile with READ_FILES permission', () => {
    guard.registerPlugin('sandbox-plugin', [PluginPermission.READ_FILES]);
    const result = sandbox.readFile('sandbox-plugin', 'src/index.ts');
    expect(result).toContain('sandboxed read');
  });

  it('should deny readFile without READ_FILES permission', () => {
    guard.registerPlugin('sandbox-plugin', []);
    expect(() => sandbox.readFile('sandbox-plugin', 'src/index.ts')).toThrow(PermissionDeniedError);
  });

  it('should allow writeFile with WRITE_FILES permission', () => {
    guard.registerPlugin('sandbox-plugin', [PluginPermission.WRITE_FILES]);
    expect(() => sandbox.writeFile('sandbox-plugin', 'output.txt', 'content')).not.toThrow();
  });

  it('should deny writeFile without WRITE_FILES permission', () => {
    guard.registerPlugin('sandbox-plugin', [PluginPermission.READ_FILES]);
    expect(() => sandbox.writeFile('sandbox-plugin', 'output.txt', 'content')).toThrow(PermissionDeniedError);
  });

  it('should allow fetch with NETWORK permission', () => {
    guard.registerPlugin('sandbox-plugin', [PluginPermission.NETWORK]);
    const result = sandbox.fetch('sandbox-plugin', 'https://api.example.com');
    expect(result).toContain('sandboxed fetch');
  });

  it('should deny fetch without NETWORK permission', () => {
    guard.registerPlugin('sandbox-plugin', []);
    expect(() => sandbox.fetch('sandbox-plugin', 'https://api.example.com')).toThrow(PermissionDeniedError);
  });

  it('should allow callAI with AI_ACCESS permission', () => {
    guard.registerPlugin('sandbox-plugin', [PluginPermission.AI_ACCESS]);
    const result = sandbox.callAI('sandbox-plugin', 'Generate code');
    expect(result).toContain('sandboxed AI call');
  });

  it('should deny callAI without AI_ACCESS permission', () => {
    guard.registerPlugin('sandbox-plugin', []);
    expect(() => sandbox.callAI('sandbox-plugin', 'Generate code')).toThrow(PermissionDeniedError);
  });

  it('should reject paths with path traversal', () => {
    guard.registerPlugin('sandbox-plugin', [PluginPermission.READ_FILES]);
    expect(() => sandbox.readFile('sandbox-plugin', '../secret/file')).toThrow('Invalid path');
  });

  it('should reject absolute paths', () => {
    guard.registerPlugin('sandbox-plugin', [PluginPermission.READ_FILES]);
    expect(() => sandbox.readFile('sandbox-plugin', '/etc/passwd')).toThrow('Invalid path');
  });

  it('should timeout long-running sandbox executions', async () => {
    const shortSandbox = new PluginSandbox(guard, { timeout: 50 });
    guard.registerPlugin('sandbox-plugin', []);

    await expect(
      shortSandbox.executeInSandbox('sandbox-plugin', async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'done';
      }),
    ).rejects.toThrow('timed out');
  });

  it('should create a context for a plugin', () => {
    const manifest = createManifest([PluginPermission.READ_FILES]);
    const context = sandbox.createContext(manifest);
    expect(context.pluginId).toBe('sandbox-plugin');
    expect(context.workspaceRoot).toBeDefined();
    expect(context.logger).toBeDefined();
  });

  it('should track file operations', () => {
    guard.registerPlugin('sandbox-plugin', [PluginPermission.READ_FILES, PluginPermission.WRITE_FILES]);
    sandbox.readFile('sandbox-plugin', 'file1.ts');
    sandbox.writeFile('sandbox-plugin', 'file2.ts', 'content');

    const ops = sandbox.getFileOperations();
    expect(ops.length).toBe(2);
    expect(ops[0].type).toBe('read');
    expect(ops[1].type).toBe('write');
  });
});

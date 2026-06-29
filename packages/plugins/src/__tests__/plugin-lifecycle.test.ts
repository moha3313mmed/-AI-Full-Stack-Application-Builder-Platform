import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HookExecutor } from '../lifecycle/hook-executor.js';
import { PluginLifecycleManager, LifecycleEvent } from '../lifecycle/plugin-lifecycle.js';
import {
  PluginCategory,
  PluginHook,
  PluginManifest,
  PluginPermission,
  PluginStatus,
} from '../types/index.js';

describe('PluginLifecycleManager', () => {
  let manager: PluginLifecycleManager;

  const createManifest = (id: string = 'test-plugin'): PluginManifest => ({
    id,
    name: 'Test Plugin',
    version: '1.0.0',
    author: 'Test Author',
    description: 'A test plugin',
    keywords: ['test'],
    category: PluginCategory.TOOLING,
    permissions: [PluginPermission.READ_FILES],
    entry: './dist/index.js',
    hooks: [PluginHook.ON_INSTALL, PluginHook.ON_ACTIVATE, PluginHook.ON_DEACTIVATE, PluginHook.ON_UNINSTALL],
    dependencies: {},
    engines: { builder: '>=1.0.0' },
  });

  beforeEach(() => {
    manager = new PluginLifecycleManager();
  });

  it('should install a plugin with INSTALLED status', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    expect(manager.getStatus('test-plugin')).toBe(PluginStatus.INSTALLED);
  });

  it('should throw when installing a plugin that is already installed', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    await expect(manager.install(manifest)).rejects.toThrow('already installed');
  });

  it('should activate an installed plugin', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    await manager.activate('test-plugin');
    expect(manager.getStatus('test-plugin')).toBe(PluginStatus.ACTIVE);
  });

  it('should deactivate an active plugin', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    await manager.activate('test-plugin');
    await manager.deactivate('test-plugin');
    expect(manager.getStatus('test-plugin')).toBe(PluginStatus.INACTIVE);
  });

  it('should uninstall an installed plugin', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    await manager.uninstall('test-plugin');
    expect(() => manager.getStatus('test-plugin')).toThrow('not installed');
  });

  it('should uninstall an inactive plugin', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    await manager.activate('test-plugin');
    await manager.deactivate('test-plugin');
    await manager.uninstall('test-plugin');
    expect(() => manager.getStatus('test-plugin')).toThrow('not installed');
  });

  it('should throw when activating a non-existent plugin', async () => {
    await expect(manager.activate('non-existent')).rejects.toThrow('not installed');
  });

  it('should throw when deactivating a non-active plugin', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    await expect(manager.deactivate('test-plugin')).rejects.toThrow('Must be "ACTIVE"');
  });

  it('should throw when uninstalling an active plugin', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    await manager.activate('test-plugin');
    await expect(manager.uninstall('test-plugin')).rejects.toThrow('Cannot uninstall');
  });

  it('should call hook function during install', async () => {
    const hookFn = vi.fn();
    const manifest = createManifest();
    await manager.install(manifest, hookFn);
    expect(hookFn).toHaveBeenCalled();
  });

  it('should call hook function during activate', async () => {
    const hookFn = vi.fn();
    const manifest = createManifest();
    await manager.install(manifest);
    await manager.activate('test-plugin', hookFn);
    expect(hookFn).toHaveBeenCalled();
  });

  it('should call hook function during deactivate', async () => {
    const hookFn = vi.fn();
    const manifest = createManifest();
    await manager.install(manifest);
    await manager.activate('test-plugin');
    await manager.deactivate('test-plugin', hookFn);
    expect(hookFn).toHaveBeenCalled();
  });

  it('should emit lifecycle events', async () => {
    const events: LifecycleEvent[] = [];
    manager.onEvent((event) => events.push(event));

    const manifest = createManifest();
    await manager.install(manifest);

    expect(events.length).toBe(1);
    expect(events[0].pluginId).toBe('test-plugin');
    expect(events[0].currentStatus).toBe(PluginStatus.INSTALLED);
  });

  it('should emit events for full lifecycle', async () => {
    const events: LifecycleEvent[] = [];
    manager.onEvent((event) => events.push(event));

    const manifest = createManifest();
    await manager.install(manifest);
    await manager.activate('test-plugin');
    await manager.deactivate('test-plugin');
    await manager.uninstall('test-plugin');

    expect(events.length).toBe(4);
  });

  it('should set status to ERROR when hook fails during activate', async () => {
    const manifest = createManifest();

    const failingHook = () => { throw new Error('Hook failed'); };

    const hookExecutor = new HookExecutor();
    const managerWithExecutor = new PluginLifecycleManager(hookExecutor);
    await managerWithExecutor.install(manifest);

    // The lifecycle manager checks the hook result's success field and throws
    await expect(managerWithExecutor.activate('test-plugin', failingHook)).rejects.toThrow('Hook ON_ACTIVATE failed');
    expect(managerWithExecutor.getStatus('test-plugin')).toBe(PluginStatus.ERROR);
  });

  it('should list all installed plugins', async () => {
    await manager.install(createManifest('plugin-1'));
    await manager.install(createManifest('plugin-2'));

    const list = manager.listPlugins();
    expect(list.length).toBe(2);
    expect(list.map((p) => p.id)).toContain('plugin-1');
    expect(list.map((p) => p.id)).toContain('plugin-2');
  });

  it('should re-activate a deactivated plugin', async () => {
    const manifest = createManifest();
    await manager.install(manifest);
    await manager.activate('test-plugin');
    await manager.deactivate('test-plugin');
    await manager.activate('test-plugin');
    expect(manager.getStatus('test-plugin')).toBe(PluginStatus.ACTIVE);
  });
});

describe('HookExecutor', () => {
  let executor: HookExecutor;

  beforeEach(() => {
    executor = new HookExecutor({ timeout: 1000 });
  });

  it('should execute a synchronous hook successfully', async () => {
    const result = await executor.execute('plugin-1', PluginHook.ON_INSTALL, () => {});
    expect(result.success).toBe(true);
    expect(result.pluginId).toBe('plugin-1');
    expect(result.hook).toBe(PluginHook.ON_INSTALL);
  });

  it('should execute an async hook successfully', async () => {
    const result = await executor.execute('plugin-1', PluginHook.ON_ACTIVATE, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(result.success).toBe(true);
  });

  it('should catch errors from hooks', async () => {
    const result = await executor.execute('plugin-1', PluginHook.ON_INSTALL, () => {
      throw new Error('Hook error');
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Hook error');
  });

  it('should timeout long-running hooks', async () => {
    const shortExecutor = new HookExecutor({ timeout: 50 });
    const result = await shortExecutor.execute('plugin-1', PluginHook.ON_INSTALL, async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });

  it('should report execution duration', async () => {
    const result = await executor.execute('plugin-1', PluginHook.ON_BUILD, async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.duration).toBeGreaterThanOrEqual(15);
  });
});

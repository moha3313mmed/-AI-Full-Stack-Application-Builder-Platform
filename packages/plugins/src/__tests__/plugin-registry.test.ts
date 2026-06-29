import { describe, it, expect, beforeEach } from 'vitest';

import { PluginRegistry } from '../registry/plugin-registry.js';
import {
  PluginCategory,
  PluginHook,
  PluginManifest,
  PluginPermission,
  PluginStatus,
} from '../types/index.js';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  const createManifest = (id: string, hooks: PluginHook[] = [PluginHook.ON_BUILD]): PluginManifest => ({
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    author: 'Test',
    description: `Description for ${id}`,
    keywords: ['test'],
    category: PluginCategory.TOOLING,
    permissions: [PluginPermission.READ_FILES],
    entry: './dist/index.js',
    hooks,
    dependencies: {},
    engines: { builder: '>=1.0.0' },
  });

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('should register a plugin successfully', () => {
    const manifest = createManifest('plugin-1');
    const entry = registry.register(manifest);
    expect(entry.manifest.id).toBe('plugin-1');
    expect(entry.status).toBe(PluginStatus.INSTALLED);
  });

  it('should throw when registering a duplicate plugin', () => {
    const manifest = createManifest('plugin-1');
    registry.register(manifest);
    expect(() => registry.register(manifest)).toThrow('already registered');
  });

  it('should get a registered plugin by ID', () => {
    const manifest = createManifest('plugin-1');
    registry.register(manifest);
    const plugin = registry.get('plugin-1');
    expect(plugin.manifest.name).toBe('Plugin plugin-1');
  });

  it('should throw when getting a non-existent plugin', () => {
    expect(() => registry.get('unknown')).toThrow('not registered');
  });

  it('should unregister a plugin', () => {
    const manifest = createManifest('plugin-1');
    registry.register(manifest);
    const result = registry.unregister('plugin-1');
    expect(result).toBe(true);
    expect(registry.has('plugin-1')).toBe(false);
  });

  it('should throw when unregistering a non-existent plugin', () => {
    expect(() => registry.unregister('unknown')).toThrow('not registered');
  });

  it('should check if a plugin exists', () => {
    const manifest = createManifest('plugin-1');
    registry.register(manifest);
    expect(registry.has('plugin-1')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
  });

  it('should list all registered plugins', () => {
    registry.register(createManifest('plugin-1'));
    registry.register(createManifest('plugin-2'));
    registry.register(createManifest('plugin-3'));
    expect(registry.list().length).toBe(3);
  });

  it('should find plugins by hook', () => {
    registry.register(createManifest('plugin-1', [PluginHook.ON_BUILD]));
    registry.register(createManifest('plugin-2', [PluginHook.ON_DEPLOY]));
    registry.register(createManifest('plugin-3', [PluginHook.ON_BUILD, PluginHook.ON_DEPLOY]));

    const buildPlugins = registry.findByHook(PluginHook.ON_BUILD);
    expect(buildPlugins.length).toBe(2);

    const deployPlugins = registry.findByHook(PluginHook.ON_DEPLOY);
    expect(deployPlugins.length).toBe(2);
  });

  it('should return empty array when no plugins match a hook', () => {
    registry.register(createManifest('plugin-1', [PluginHook.ON_BUILD]));
    const result = registry.findByHook(PluginHook.ON_CODE_GEN);
    expect(result).toEqual([]);
  });

  it('should update plugin status', () => {
    registry.register(createManifest('plugin-1'));
    registry.updateStatus('plugin-1', PluginStatus.ACTIVE);
    expect(registry.get('plugin-1').status).toBe(PluginStatus.ACTIVE);
  });

  it('should count registered plugins', () => {
    expect(registry.count()).toBe(0);
    registry.register(createManifest('plugin-1'));
    registry.register(createManifest('plugin-2'));
    expect(registry.count()).toBe(2);
  });

  it('should clear all plugins', () => {
    registry.register(createManifest('plugin-1'));
    registry.register(createManifest('plugin-2'));
    registry.clear();
    expect(registry.count()).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it('should find plugins by status', () => {
    registry.register(createManifest('plugin-1'));
    registry.register(createManifest('plugin-2'));
    registry.updateStatus('plugin-1', PluginStatus.ACTIVE);

    const active = registry.findByStatus(PluginStatus.ACTIVE);
    expect(active.length).toBe(1);
    expect(active[0].manifest.id).toBe('plugin-1');
  });
});

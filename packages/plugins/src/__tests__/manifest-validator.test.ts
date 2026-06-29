import { describe, it, expect, beforeEach } from 'vitest';

import { ManifestLoader } from '../manifest/manifest-loader.js';
import { ManifestValidator } from '../manifest/manifest-validator.js';
import {
  PluginCategory,
  PluginHook,
  PluginPermission,
} from '../types/index.js';

describe('ManifestValidator', () => {
  let validator: ManifestValidator;

  const validManifest = {
    id: 'plugin-test',
    name: 'Test Plugin',
    version: '1.0.0',
    author: 'Test Author',
    description: 'A test plugin',
    keywords: ['test', 'example'],
    category: PluginCategory.TOOLING,
    permissions: [PluginPermission.READ_FILES],
    entry: './dist/index.js',
    hooks: [PluginHook.ON_INSTALL, PluginHook.ON_ACTIVATE],
    dependencies: {},
    engines: { builder: '>=1.0.0' },
  };

  beforeEach(() => {
    validator = new ManifestValidator();
  });

  it('should validate a correct manifest successfully', () => {
    expect(() => validator.validate(validManifest)).not.toThrow();
  });

  it('should throw for null manifest', () => {
    expect(() => validator.validate(null)).toThrow('Manifest must be a non-null object');
  });

  it('should throw for non-object manifest', () => {
    expect(() => validator.validate('string')).toThrow('Manifest must be a non-null object');
  });

  it('should throw for missing id field', () => {
    const { id: _id, ...noId } = validManifest;
    expect(() => validator.validate(noId)).toThrow('missing required field: "id"');
  });

  it('should throw for missing name field', () => {
    const { name: _name, ...noName } = validManifest;
    expect(() => validator.validate(noName)).toThrow('missing required field: "name"');
  });

  it('should throw for missing version field', () => {
    const { version: _version, ...noVersion } = validManifest;
    expect(() => validator.validate(noVersion)).toThrow('missing required field: "version"');
  });

  it('should throw for missing author field', () => {
    const { author: _author, ...noAuthor } = validManifest;
    expect(() => validator.validate(noAuthor)).toThrow('missing required field: "author"');
  });

  it('should throw for missing entry field', () => {
    const { entry: _entry, ...noEntry } = validManifest;
    expect(() => validator.validate(noEntry)).toThrow('missing required field: "entry"');
  });

  it('should throw for invalid semver version', () => {
    const invalidVersion = { ...validManifest, version: 'not-a-version' };
    expect(() => validator.validate(invalidVersion)).toThrow('Invalid version format');
  });

  it('should throw for partial semver version', () => {
    const partialVersion = { ...validManifest, version: '1.0' };
    expect(() => validator.validate(partialVersion)).toThrow('Invalid version format');
  });

  it('should accept valid semver with prerelease', () => {
    const prerelease = { ...validManifest, version: '1.0.0-beta.1' };
    expect(() => validator.validate(prerelease)).not.toThrow();
  });

  it('should throw for invalid permission', () => {
    const invalidPerm = { ...validManifest, permissions: ['INVALID_PERM'] };
    expect(() => validator.validate(invalidPerm)).toThrow('Invalid permission: "INVALID_PERM"');
  });

  it('should throw for invalid hook', () => {
    const invalidHook = { ...validManifest, hooks: ['onInvalidHook'] };
    expect(() => validator.validate(invalidHook)).toThrow('Invalid hook: "onInvalidHook"');
  });

  it('should throw for non-array permissions', () => {
    const badPerms = { ...validManifest, permissions: 'READ_FILES' };
    expect(() => validator.validate(badPerms)).toThrow('"permissions" must be an array');
  });

  it('should throw for non-array hooks', () => {
    const badHooks = { ...validManifest, hooks: 'onInstall' };
    expect(() => validator.validate(badHooks)).toThrow('"hooks" must be an array');
  });

  it('should throw for invalid category', () => {
    const badCategory = { ...validManifest, category: 'INVALID_CATEGORY' };
    expect(() => validator.validate(badCategory)).toThrow('Invalid category');
  });

  it('should throw for empty id string', () => {
    const emptyId = { ...validManifest, id: '' };
    expect(() => validator.validate(emptyId)).toThrow('"id" must be a non-empty string');
  });

  it('should throw for missing engines.builder', () => {
    const noBuilder = { ...validManifest, engines: {} };
    expect(() => validator.validate(noBuilder)).toThrow('"engines.builder" is required');
  });

  it('should throw for non-object dependencies', () => {
    const badDeps = { ...validManifest, dependencies: 'string' };
    expect(() => validator.validate(badDeps)).toThrow('"dependencies" must be an object');
  });
});

describe('ManifestLoader', () => {
  let loader: ManifestLoader;

  const validManifestJson = JSON.stringify({
    id: 'plugin-test',
    name: 'Test Plugin',
    version: '1.0.0',
    author: 'Test Author',
    description: 'A test plugin',
    keywords: ['test'],
    category: PluginCategory.TOOLING,
    permissions: [PluginPermission.READ_FILES],
    entry: './dist/index.js',
    hooks: [PluginHook.ON_INSTALL],
    dependencies: {},
    engines: { builder: '>=1.0.0' },
  });

  beforeEach(() => {
    loader = new ManifestLoader();
  });

  it('should load a valid manifest from JSON string', () => {
    const manifest = loader.loadFromString(validManifestJson);
    expect(manifest.id).toBe('plugin-test');
    expect(manifest.name).toBe('Test Plugin');
  });

  it('should throw for invalid JSON string', () => {
    expect(() => loader.loadFromString('not json')).toThrow('Failed to parse manifest JSON');
  });

  it('should load a valid manifest from object', () => {
    const obj = JSON.parse(validManifestJson);
    const manifest = loader.loadFromObject(obj);
    expect(manifest.id).toBe('plugin-test');
  });

  it('should throw for invalid manifest object', () => {
    expect(() => loader.loadFromObject({})).toThrow('missing required field');
  });
});

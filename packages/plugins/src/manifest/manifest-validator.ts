import { PluginHook, PluginManifest, PluginPermission, PluginCategory } from '../types/index.js';

/**
 * ManifestValidator validates plugin manifests against required fields,
 * version format (semver), permission validation, and hook validation.
 */
export class ManifestValidator {
  private static readonly SEMVER_REGEX =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

  private static readonly REQUIRED_FIELDS: (keyof PluginManifest)[] = [
    'id',
    'name',
    'version',
    'author',
    'description',
    'entry',
    'hooks',
    'permissions',
    'category',
    'keywords',
    'dependencies',
    'engines',
  ];

  /**
   * Validate a plugin manifest. Throws descriptive errors for invalid manifests.
   */
  validate(manifest: unknown): asserts manifest is PluginManifest {
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('Manifest must be a non-null object');
    }

    const obj = manifest as Record<string, unknown>;

    // Check required fields
    for (const field of ManifestValidator.REQUIRED_FIELDS) {
      if (obj[field] === undefined || obj[field] === null) {
        throw new Error(`Manifest is missing required field: "${field}"`);
      }
    }

    // Validate string fields
    this.validateStringField(obj, 'id');
    this.validateStringField(obj, 'name');
    this.validateStringField(obj, 'version');
    this.validateStringField(obj, 'author');
    this.validateStringField(obj, 'description');
    this.validateStringField(obj, 'entry');

    // Validate version is valid semver
    if (!ManifestValidator.SEMVER_REGEX.test(obj['version'] as string)) {
      throw new Error(
        `Invalid version format: "${obj['version']}". Must be valid semver (e.g., "1.0.0")`,
      );
    }

    // Validate category
    const validCategories = Object.values(PluginCategory);
    if (!validCategories.includes(obj['category'] as PluginCategory)) {
      throw new Error(
        `Invalid category: "${obj['category']}". Must be one of: ${validCategories.join(', ')}`,
      );
    }

    // Validate permissions array
    if (!Array.isArray(obj['permissions'])) {
      throw new Error('Manifest "permissions" must be an array');
    }
    const validPermissions = Object.values(PluginPermission);
    for (const perm of obj['permissions'] as unknown[]) {
      if (!validPermissions.includes(perm as PluginPermission)) {
        throw new Error(
          `Invalid permission: "${perm}". Must be one of: ${validPermissions.join(', ')}`,
        );
      }
    }

    // Validate hooks array
    if (!Array.isArray(obj['hooks'])) {
      throw new Error('Manifest "hooks" must be an array');
    }
    const validHooks = Object.values(PluginHook);
    for (const hook of obj['hooks'] as unknown[]) {
      if (!validHooks.includes(hook as PluginHook)) {
        throw new Error(`Invalid hook: "${hook}". Must be one of: ${validHooks.join(', ')}`);
      }
    }

    // Validate keywords array
    if (!Array.isArray(obj['keywords'])) {
      throw new Error('Manifest "keywords" must be an array');
    }

    // Validate dependencies object
    if (typeof obj['dependencies'] !== 'object' || Array.isArray(obj['dependencies'])) {
      throw new Error('Manifest "dependencies" must be an object');
    }

    // Validate engines object
    if (typeof obj['engines'] !== 'object' || Array.isArray(obj['engines'])) {
      throw new Error('Manifest "engines" must be an object');
    }
    const engines = obj['engines'] as Record<string, unknown>;
    if (!engines['builder'] || typeof engines['builder'] !== 'string') {
      throw new Error('Manifest "engines.builder" is required and must be a string');
    }
  }

  private validateStringField(obj: Record<string, unknown>, field: string): void {
    if (typeof obj[field] !== 'string' || (obj[field] as string).trim() === '') {
      throw new Error(`Manifest "${field}" must be a non-empty string`);
    }
  }
}

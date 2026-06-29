import { PluginManifest } from '../types/index.js';

import { ManifestValidator } from './manifest-validator.js';

/**
 * ManifestLoader loads and parses plugin manifests from JSON strings or objects.
 * Validates with ManifestValidator and returns typed PluginManifest.
 */
export class ManifestLoader {
  private validator: ManifestValidator;

  constructor(validator?: ManifestValidator) {
    this.validator = validator ?? new ManifestValidator();
  }

  /**
   * Load a plugin manifest from a JSON string.
   * Parses the JSON, validates the result, and returns a typed PluginManifest.
   */
  loadFromString(json: string): PluginManifest {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new Error(
        `Failed to parse manifest JSON: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
      );
    }

    return this.loadFromObject(parsed);
  }

  /**
   * Load a plugin manifest from a plain object.
   * Validates the object and returns it typed as PluginManifest.
   */
  loadFromObject(obj: unknown): PluginManifest {
    this.validator.validate(obj);
    return obj as PluginManifest;
  }
}

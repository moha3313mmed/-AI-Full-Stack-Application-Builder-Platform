/**
 * EnvironmentManager manages environment variables per deployment.
 * Supports setting, getting, validating, and masking sensitive values.
 */
export class EnvironmentManager {
  private variables: Map<string, string> = new Map();
  private sensitiveKeys: Set<string> = new Set([
    'API_KEY',
    'SECRET',
    'PASSWORD',
    'TOKEN',
    'PRIVATE_KEY',
    'DATABASE_URL',
    'REDIS_URL',
    'AWS_SECRET_ACCESS_KEY',
  ]);

  /**
   * Set multiple environment variables at once.
   */
  setVariables(vars: Record<string, string>): void {
    for (const [key, value] of Object.entries(vars)) {
      this.variables.set(key, value);
    }
  }

  /**
   * Set a single environment variable.
   */
  setVariable(key: string, value: string): void {
    this.variables.set(key, value);
  }

  /**
   * Get all environment variables (unmasked).
   */
  getVariables(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of this.variables) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Get a single environment variable value.
   */
  getVariable(key: string): string | undefined {
    return this.variables.get(key);
  }

  /**
   * Remove a variable.
   */
  removeVariable(key: string): boolean {
    return this.variables.delete(key);
  }

  /**
   * Validate that all required environment variables are set.
   * Returns an array of missing variable names.
   */
  validateRequired(requiredKeys: string[]): string[] {
    const missing: string[] = [];
    for (const key of requiredKeys) {
      if (!this.variables.has(key) || this.variables.get(key)?.trim() === '') {
        missing.push(key);
      }
    }
    return missing;
  }

  /**
   * Check if a key is considered sensitive.
   */
  isSensitive(key: string): boolean {
    const upperKey = key.toUpperCase();
    for (const sensitivePattern of this.sensitiveKeys) {
      if (upperKey.includes(sensitivePattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Mark a key as sensitive.
   */
  addSensitivePattern(pattern: string): void {
    this.sensitiveKeys.add(pattern.toUpperCase());
  }

  /**
   * Get all variables with sensitive values masked.
   */
  getMaskedVariables(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of this.variables) {
      result[key] = this.isSensitive(key) ? this.maskValue(value) : value;
    }
    return result;
  }

  /**
   * Mask a sensitive value, showing only the first 4 characters.
   */
  maskValue(value: string): string {
    if (value.length <= 4) {
      return '****';
    }
    return value.slice(0, 4) + '*'.repeat(Math.min(value.length - 4, 20));
  }

  /**
   * Encode sensitive variables using base64 for transport.
   *
   * TODO: Replace with proper AES-256-GCM encryption with key management.
   * Base64 provides NO confidentiality -- it is only encoding, not encryption.
   * See ADR 012 for the target encryption approach.
   */
  encodeVariables(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of this.variables) {
      if (this.isSensitive(key)) {
        result[key] = Buffer.from(value).toString('base64');
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Decode a base64-encoded value.
   *
   * TODO: Replace with proper AES-256-GCM decryption when real encryption is implemented.
   */
  decodeValue(encodedValue: string): string {
    return Buffer.from(encodedValue, 'base64').toString('utf-8');
  }

  /**
   * @deprecated Use encodeVariables() instead. This method uses base64 encoding, not real encryption.
   */
  encryptVariables(): Record<string, string> {
    return this.encodeVariables();
  }

  /**
   * @deprecated Use decodeValue() instead. This method uses base64 decoding, not real decryption.
   */
  decryptValue(encodedValue: string): string {
    return this.decodeValue(encodedValue);
  }

  /**
   * Clear all variables.
   */
  clear(): void {
    this.variables.clear();
  }

  /**
   * Get the count of variables.
   */
  get size(): number {
    return this.variables.size;
  }
}

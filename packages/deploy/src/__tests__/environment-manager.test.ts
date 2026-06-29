import { describe, it, expect, beforeEach } from 'vitest';

import { EnvironmentManager } from '../pipeline/environment-manager.js';

describe('EnvironmentManager', () => {
  let manager: EnvironmentManager;

  beforeEach(() => {
    manager = new EnvironmentManager();
  });

  it('should set and get variables', () => {
    manager.setVariables({ NODE_ENV: 'production', PORT: '3000' });

    const vars = manager.getVariables();

    expect(vars.NODE_ENV).toBe('production');
    expect(vars.PORT).toBe('3000');
  });

  it('should set a single variable', () => {
    manager.setVariable('APP_NAME', 'my-app');

    expect(manager.getVariable('APP_NAME')).toBe('my-app');
  });

  it('should return undefined for non-existent variables', () => {
    expect(manager.getVariable('MISSING')).toBeUndefined();
  });

  it('should remove a variable', () => {
    manager.setVariable('TO_REMOVE', 'value');
    expect(manager.getVariable('TO_REMOVE')).toBe('value');

    const result = manager.removeVariable('TO_REMOVE');

    expect(result).toBe(true);
    expect(manager.getVariable('TO_REMOVE')).toBeUndefined();
  });

  it('should validate required variables and return missing ones', () => {
    manager.setVariables({ DB_HOST: 'localhost', DB_PORT: '5432' });

    const missing = manager.validateRequired(['DB_HOST', 'DB_PORT', 'DB_PASSWORD', 'DB_NAME']);

    expect(missing).toEqual(['DB_PASSWORD', 'DB_NAME']);
  });

  it('should treat empty string values as missing in validation', () => {
    manager.setVariables({ API_KEY: '', DB_HOST: 'localhost' });

    const missing = manager.validateRequired(['API_KEY', 'DB_HOST']);

    expect(missing).toEqual(['API_KEY']);
  });

  it('should return empty array when all required variables are present', () => {
    manager.setVariables({ A: 'val1', B: 'val2' });

    const missing = manager.validateRequired(['A', 'B']);

    expect(missing).toHaveLength(0);
  });

  it('should identify sensitive keys', () => {
    expect(manager.isSensitive('DATABASE_URL')).toBe(true);
    expect(manager.isSensitive('API_KEY')).toBe(true);
    expect(manager.isSensitive('MY_SECRET')).toBe(true);
    expect(manager.isSensitive('AUTH_TOKEN')).toBe(true);
    expect(manager.isSensitive('NODE_ENV')).toBe(false);
    expect(manager.isSensitive('PORT')).toBe(false);
  });

  it('should mask sensitive values in getMaskedVariables', () => {
    manager.setVariables({
      NODE_ENV: 'production',
      API_KEY: 'sk-1234567890abcdef',
      DATABASE_URL: 'postgres://user:pass@host/db',
    });

    const masked = manager.getMaskedVariables();

    expect(masked.NODE_ENV).toBe('production');
    expect(masked.API_KEY).not.toBe('sk-1234567890abcdef');
    expect(masked.API_KEY).toContain('sk-1');
    expect(masked.API_KEY).toContain('*');
    expect(masked.DATABASE_URL).toContain('post');
    expect(masked.DATABASE_URL).toContain('*');
  });

  it('should mask short values completely', () => {
    const masked = manager.maskValue('abc');

    expect(masked).toBe('****');
  });

  it('should mask values showing only first 4 characters', () => {
    const masked = manager.maskValue('my-secret-value-12345');

    expect(masked.startsWith('my-s')).toBe(true);
    expect(masked).toContain('*');
    expect(masked).not.toContain('ecret');
  });

  it('should encrypt sensitive variables with base64', () => {
    manager.setVariables({
      NODE_ENV: 'production',
      API_KEY: 'secret-key-123',
    });

    const encrypted = manager.encryptVariables();

    expect(encrypted.NODE_ENV).toBe('production');
    expect(encrypted.API_KEY).not.toBe('secret-key-123');
    expect(Buffer.from(encrypted.API_KEY, 'base64').toString('utf-8')).toBe('secret-key-123');
  });

  it('should decrypt encrypted values', () => {
    const original = 'my-secret-password';
    const encoded = Buffer.from(original).toString('base64');

    const decrypted = manager.decryptValue(encoded);

    expect(decrypted).toBe(original);
  });

  it('should add custom sensitive patterns', () => {
    manager.addSensitivePattern('STRIPE');

    expect(manager.isSensitive('STRIPE_KEY')).toBe(true);
    expect(manager.isSensitive('my_stripe_secret')).toBe(true);
  });

  it('should clear all variables', () => {
    manager.setVariables({ A: '1', B: '2', C: '3' });
    expect(manager.size).toBe(3);

    manager.clear();

    expect(manager.size).toBe(0);
    expect(manager.getVariables()).toEqual({});
  });

  it('should track variable count with size property', () => {
    expect(manager.size).toBe(0);

    manager.setVariable('A', '1');
    expect(manager.size).toBe(1);

    manager.setVariable('B', '2');
    expect(manager.size).toBe(2);

    manager.removeVariable('A');
    expect(manager.size).toBe(1);
  });
});

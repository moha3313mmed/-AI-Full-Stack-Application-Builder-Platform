import { SecurityScanType } from '../types/index.js';

import { BaseSecurityScanner } from './base-scanner.js';

export type ScannerFactory = () => BaseSecurityScanner;

/**
 * ScannerRegistry manages available security scanners using the strategy pattern.
 * Allows registration of scanner factories and retrieval by SecurityScanType.
 */
export class ScannerRegistry {
  private scanners: Map<SecurityScanType, ScannerFactory> = new Map();

  /**
   * Register a scanner factory for a given SecurityScanType.
   */
  register(scanType: SecurityScanType, factory: ScannerFactory): void {
    this.scanners.set(scanType, factory);
  }

  /**
   * Get an instance of the scanner for the given SecurityScanType.
   * Throws if the scanner is not registered.
   */
  get(scanType: SecurityScanType): BaseSecurityScanner {
    const factory = this.scanners.get(scanType);
    if (!factory) {
      throw new Error(
        `Scanner for "${scanType}" is not registered. Available scanners: ${this.listAvailable().join(', ')}`,
      );
    }
    return factory();
  }

  /**
   * Check if a scanner is registered for a given scan type.
   */
  has(scanType: SecurityScanType): boolean {
    return this.scanners.has(scanType);
  }

  /**
   * List all registered (available) scan types.
   */
  listAvailable(): SecurityScanType[] {
    return Array.from(this.scanners.keys());
  }

  /**
   * Remove a scanner from the registry.
   */
  unregister(scanType: SecurityScanType): boolean {
    return this.scanners.delete(scanType);
  }

  /**
   * Clear all registered scanners.
   */
  clear(): void {
    this.scanners.clear();
  }
}

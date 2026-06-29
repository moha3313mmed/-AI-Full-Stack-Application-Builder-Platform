import { Injectable } from '@nestjs/common';

export interface RateLimitEntry {
  points: number;
  resetAt: number;
}

export interface RateLimitConfig {
  points: number;
  duration: number; // seconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
}

@Injectable()
export class RateLimitService {
  private readonly store = new Map<string, RateLimitEntry[]>();

  /**
   * Check and consume a rate limit point using sliding window algorithm.
   * Returns whether the request is allowed and remaining capacity.
   */
  async consume(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.duration * 1000;

    // Get existing entries and filter out expired ones
    let entries = this.store.get(key) || [];
    entries = entries.filter((entry) => entry.resetAt > windowStart);

    const currentPoints = entries.reduce((sum, e) => sum + e.points, 0);
    const remaining = Math.max(0, config.points - currentPoints);
    const resetAt = now + config.duration * 1000;

    if (currentPoints >= config.points) {
      // Rate limit exceeded
      const earliestEntry = entries[0];
      return {
        allowed: false,
        remaining: 0,
        resetAt: earliestEntry
          ? earliestEntry.resetAt + config.duration * 1000
          : resetAt,
        total: config.points,
      };
    }

    // Consume a point
    entries.push({ points: 1, resetAt: now });
    this.store.set(key, entries);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
      total: config.points,
    };
  }

  /**
   * Get current usage for a key without consuming.
   */
  async get(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.duration * 1000;

    const entries = (this.store.get(key) || []).filter(
      (entry) => entry.resetAt > windowStart,
    );

    const currentPoints = entries.reduce((sum, e) => sum + e.points, 0);
    const remaining = Math.max(0, config.points - currentPoints);

    return {
      allowed: currentPoints < config.points,
      remaining,
      resetAt: now + config.duration * 1000,
      total: config.points,
    };
  }

  /**
   * Reset rate limit for a key.
   */
  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Build rate limit key from user ID and route identifier.
   */
  buildKey(userId: string, route: string): string {
    return `rate_limit:${userId}:${route}`;
  }
}

// ============================================================================
// ContextWindowManager - Token budget management across agents
// ============================================================================

import { type TokenBudget } from '../types/index.js';

/**
 * ContextWindowManager intelligently manages token budgets across agents.
 * It allocates, tracks, and balances token usage to prevent exceeding limits.
 */
export class ContextWindowManager {
  private budgets: Map<string, TokenBudget> = new Map();
  private globalBudget: number;
  private globalUsed: number = 0;
  private summaryThreshold: number;

  constructor(options: { globalBudget: number; summaryThreshold?: number }) {
    this.globalBudget = options.globalBudget;
    this.summaryThreshold = options.summaryThreshold ?? 0.8;
  }

  /**
   * Allocate a token budget for an agent.
   */
  allocate(agentId: string, budget: number): TokenBudget {
    const allocation: TokenBudget = {
      agentId,
      totalBudget: budget,
      used: 0,
      reserved: 0,
      available: budget,
    };
    this.budgets.set(agentId, allocation);
    return allocation;
  }

  /**
   * Record token usage for an agent.
   */
  recordUsage(agentId: string, tokens: number): void {
    const budget = this.budgets.get(agentId);
    if (!budget) {
      throw new Error(`No budget allocated for agent ${agentId}`);
    }
    budget.used += tokens;
    budget.available = budget.totalBudget - budget.used - budget.reserved;
    this.globalUsed += tokens;
  }

  /**
   * Reserve tokens for an upcoming operation.
   */
  reserve(agentId: string, tokens: number): boolean {
    const budget = this.budgets.get(agentId);
    if (!budget) return false;
    if (budget.available < tokens) return false;

    budget.reserved += tokens;
    budget.available = budget.totalBudget - budget.used - budget.reserved;
    return true;
  }

  /**
   * Release previously reserved tokens.
   */
  releaseReservation(agentId: string, tokens: number): void {
    const budget = this.budgets.get(agentId);
    if (!budget) return;
    budget.reserved = Math.max(0, budget.reserved - tokens);
    budget.available = budget.totalBudget - budget.used - budget.reserved;
  }

  /**
   * Check if an agent needs context summarization.
   */
  needsSummarization(agentId: string): boolean {
    const budget = this.budgets.get(agentId);
    if (!budget) return false;
    return budget.used / budget.totalBudget >= this.summaryThreshold;
  }

  /**
   * Reset usage for an agent (e.g., after summarization).
   */
  resetUsage(agentId: string, newUsed: number = 0): void {
    const budget = this.budgets.get(agentId);
    if (!budget) return;
    this.globalUsed -= budget.used - newUsed;
    budget.used = newUsed;
    budget.available = budget.totalBudget - budget.used - budget.reserved;
  }

  /**
   * Get the budget for an agent.
   */
  getBudget(agentId: string): TokenBudget | undefined {
    return this.budgets.get(agentId);
  }

  /**
   * Get global token usage statistics.
   */
  getGlobalStats(): { totalBudget: number; used: number; available: number; utilizationPercent: number } {
    return {
      totalBudget: this.globalBudget,
      used: this.globalUsed,
      available: this.globalBudget - this.globalUsed,
      utilizationPercent: this.globalBudget > 0 ? (this.globalUsed / this.globalBudget) * 100 : 0,
    };
  }

  /**
   * Check if global budget allows more operations.
   */
  hasGlobalBudget(tokensNeeded: number): boolean {
    return this.globalUsed + tokensNeeded <= this.globalBudget;
  }

  /**
   * Remove an agent's budget allocation.
   */
  deallocate(agentId: string): void {
    const budget = this.budgets.get(agentId);
    if (budget) {
      this.globalUsed -= budget.used;
      this.budgets.delete(agentId);
    }
  }
}

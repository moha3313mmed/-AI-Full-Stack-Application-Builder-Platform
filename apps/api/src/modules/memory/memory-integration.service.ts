import { Injectable, Logger } from '@nestjs/common';

import { ConversationSummarizer } from './conversation-summarizer';
import type { ConversationMessage } from './conversation-summarizer';
import { MemoryExtractor } from './memory-extractor';
import { MemoryService } from './memory.service';

/**
 * Result of loading memory context for AI injection.
 */
export interface MemoryContext {
  /** Formatted context string ready for AI prompt injection */
  contextString: string;
  /** Number of memory entries loaded */
  entryCount: number;
  /** Estimated token count of the context */
  estimatedTokens: number;
}

/**
 * Outcome data to store after successful code generation.
 */
export interface GenerationOutcome {
  description: string;
  filesChanged: string[];
  codeSnippets: Record<string, string>;
  intent: string;
}

/**
 * MemoryIntegrationService bridges the workflow pipeline with the memory system.
 *
 * Responsibilities:
 * - Load project memory context before AI calls (with token budget enforcement)
 * - Store generation outcomes after successful code generation
 * - Trigger conversation summarization when thresholds are met
 * - Hydrate full project context on project load
 */
@Injectable()
export class MemoryIntegrationService {
  private readonly logger = new Logger(MemoryIntegrationService.name);

  /** Approximate characters per token for estimation */
  private static readonly CHARS_PER_TOKEN = 4;

  /** Maximum token budget for memory context injection into AI prompts */
  private static readonly MAX_CONTEXT_TOKENS = 4000;

  constructor(
    private readonly memoryService: MemoryService,
    private readonly memoryExtractor: MemoryExtractor,
    private readonly conversationSummarizer: ConversationSummarizer,
  ) {}

  /**
   * Load relevant project memory and format it for AI prompt injection.
   * Called before every AI call in the workflow.
   * Enforces a token budget to prevent exceeding model context limits.
   * Truncates at logical entry boundaries to avoid partial/confusing context.
   */
  async loadContext(projectId: string): Promise<MemoryContext> {
    try {
      let contextString = await this.memoryService.getProjectContext(projectId);

      const maxChars = MemoryIntegrationService.MAX_CONTEXT_TOKENS * MemoryIntegrationService.CHARS_PER_TOKEN;

      // Truncate at entry boundaries if context exceeds token budget
      if (contextString.length > maxChars) {
        this.logger.warn(
          `Memory context for project ${projectId} exceeds token budget ` +
          `(${Math.ceil(contextString.length / MemoryIntegrationService.CHARS_PER_TOKEN)} tokens, ` +
          `max ${MemoryIntegrationService.MAX_CONTEXT_TOKENS}). Truncating at entry boundaries.`,
        );
        contextString = this.truncateAtEntryBoundary(contextString, maxChars);
      }

      const estimatedTokens = Math.ceil(
        contextString.length / MemoryIntegrationService.CHARS_PER_TOKEN,
      );

      // Count entries from the context (count lines starting with "- ")
      const entryCount = (contextString.match(/^- /gm) || []).length;

      return {
        contextString,
        entryCount,
        estimatedTokens,
      };
    } catch (error) {
      this.logger.error(`Failed to load memory context for project ${projectId}: ${error}`);
      return {
        contextString: '',
        entryCount: 0,
        estimatedTokens: 0,
      };
    }
  }

  /**
   * Truncate context string at logical boundaries (section headers or entry lines)
   * rather than cutting mid-content which would confuse the model.
   */
  private truncateAtEntryBoundary(content: string, maxChars: number): string {
    // Split into lines and rebuild up to the budget
    const lines = content.split('\n');
    let accumulated = '';
    let lastGoodBreakpoint = '';

    for (const line of lines) {
      const candidate = accumulated + (accumulated ? '\n' : '') + line;

      if (candidate.length > maxChars) {
        // We exceeded the budget; use the last good breakpoint
        break;
      }

      accumulated = candidate;

      // Track breakpoints at section headers (## ...) and entry starts (- ...)
      if (line.startsWith('## ') || line.startsWith('- ') || line.trim() === '') {
        lastGoodBreakpoint = accumulated;
      }
    }

    // Use the last clean breakpoint if available, otherwise use what we accumulated
    const truncated = lastGoodBreakpoint || accumulated;
    return truncated + '\n\n[Memory context truncated due to size limits]';
  }

  /**
   * Store generation outcomes after successful code generation.
   * Triggers the MemoryExtractor to analyze the generated code and
   * persist patterns, decisions, and conventions.
   */
  async storeOutcome(projectId: string, outcome: GenerationOutcome): Promise<void> {
    try {
      await this.memoryExtractor.extractFromGeneratedCode(
        projectId,
        outcome.filesChanged,
        outcome.codeSnippets,
        outcome.description,
      );

      this.logger.debug(
        `Stored generation outcome for project ${projectId}: ${outcome.filesChanged.length} files`,
      );
    } catch (error) {
      // Memory storage should not break the workflow
      this.logger.warn(`Failed to store generation outcome: ${error}`);
    }
  }

  /**
   * Track a conversation message and trigger summarization if threshold is reached.
   */
  async trackMessage(
    projectId: string,
    conversationId: string,
    messages: ConversationMessage[],
  ): Promise<void> {
    const shouldSummarize = this.conversationSummarizer.shouldSummarize(conversationId);

    if (shouldSummarize) {
      try {
        await this.conversationSummarizer.summarize(projectId, conversationId, messages);
        this.logger.debug(
          `Conversation ${conversationId} summarized after ${messages.length} messages`,
        );
      } catch (error) {
        this.logger.warn(`Conversation summarization failed: ${error}`);
      }
    }
  }

  /**
   * Manually trigger conversation summarization.
   * Used by the memory management API endpoint.
   */
  async triggerSummarization(
    projectId: string,
    conversationId: string,
    messages: ConversationMessage[],
  ): Promise<{ summary: string; stored: boolean }> {
    try {
      const result = await this.conversationSummarizer.summarize(
        projectId,
        conversationId,
        messages,
      );

      return {
        summary: result.summary,
        stored: !!result.memoryEntryId,
      };
    } catch (error) {
      this.logger.error(`Manual summarization failed: ${error}`);
      return {
        summary: '',
        stored: false,
      };
    }
  }

  /**
   * Hydrate full project context from the database.
   * Called on project load to ensure AI has full understanding.
   */
  async hydrateProjectContext(projectId: string): Promise<MemoryContext> {
    return this.loadContext(projectId);
  }

  /**
   * Get memory statistics for a project.
   */
  async getMemoryStats(projectId: string): Promise<{
    totalEntries: number;
    entriesByCategory: Record<string, number>;
    estimatedTotalTokens: number;
  }> {
    try {
      const { items, total } = await this.memoryService.listByProject(projectId, 1000, 0);

      const entriesByCategory: Record<string, number> = {};
      let totalContentLength = 0;

      for (const item of items) {
        const cat = item.category as string;
        entriesByCategory[cat] = (entriesByCategory[cat] || 0) + 1;
        totalContentLength += (item.title?.length || 0) + (item.content?.length || 0);
      }

      return {
        totalEntries: total,
        entriesByCategory,
        estimatedTotalTokens: Math.ceil(
          totalContentLength / MemoryIntegrationService.CHARS_PER_TOKEN,
        ),
      };
    } catch (error) {
      this.logger.error(`Failed to get memory stats: ${error}`);
      return {
        totalEntries: 0,
        entriesByCategory: {},
        estimatedTotalTokens: 0,
      };
    }
  }
}

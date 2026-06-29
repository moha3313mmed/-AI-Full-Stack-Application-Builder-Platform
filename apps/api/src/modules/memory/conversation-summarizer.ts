import { Injectable, Logger } from '@nestjs/common';

import { AiService } from '../ai/ai.service';

import { MemoryCategoryDto } from './dto/create-memory.dto';
import { MemoryService } from './memory.service';

/**
 * Message structure used for summarization.
 */
export interface ConversationMessage {
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Summary result from the conversation summarizer.
 */
export interface SummarizationResult {
  summary: string;
  decisionsExtracted: string[];
  topicsDiscussed: string[];
  memoryEntryId?: string;
}

/**
 * ConversationSummarizer periodically summarizes conversation history
 * into concise memory entries that persist project understanding across sessions.
 *
 * It triggers every N messages (configurable threshold) and produces
 * FEATURE_HISTORY entries capturing what was discussed, decided, and generated.
 */
@Injectable()
export class ConversationSummarizer {
  private readonly logger = new Logger(ConversationSummarizer.name);

  /** Number of messages after which summarization triggers */
  private readonly summarizationThreshold = 5;

  /** Track message counts per conversation to know when to trigger */
  private readonly messageCounters = new Map<string, number>();

  constructor(
    private readonly memoryService: MemoryService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Track a new message and determine if summarization should trigger.
   * Returns true if summarization threshold has been reached.
   */
  shouldSummarize(conversationId: string): boolean {
    const current = this.messageCounters.get(conversationId) || 0;
    const newCount = current + 1;
    this.messageCounters.set(conversationId, newCount);

    return newCount >= this.summarizationThreshold;
  }

  /**
   * Reset the message counter for a conversation after summarization.
   */
  resetCounter(conversationId: string): void {
    this.messageCounters.set(conversationId, 0);
  }

  /**
   * Get the current message count for a conversation.
   */
  getMessageCount(conversationId: string): number {
    return this.messageCounters.get(conversationId) || 0;
  }

  /**
   * Summarize a set of conversation messages and store as a memory entry.
   */
  async summarize(
    projectId: string,
    conversationId: string,
    messages: ConversationMessage[],
  ): Promise<SummarizationResult> {
    if (messages.length === 0) {
      return {
        summary: '',
        decisionsExtracted: [],
        topicsDiscussed: [],
      };
    }

    // Try AI-powered summarization first
    const aiSummary = await this.generateAiSummary(messages);

    if (aiSummary) {
      // Store the AI-generated summary
      const memoryEntry = await this.storeConversationSummary(
        projectId,
        conversationId,
        aiSummary.summary,
        aiSummary.decisionsExtracted,
        aiSummary.topicsDiscussed,
      );

      this.resetCounter(conversationId);

      return {
        ...aiSummary,
        memoryEntryId: memoryEntry?.id,
      };
    }

    // Fallback to heuristic summarization
    const heuristicResult = this.heuristicSummarize(messages);

    const memoryEntry = await this.storeConversationSummary(
      projectId,
      conversationId,
      heuristicResult.summary,
      heuristicResult.decisionsExtracted,
      heuristicResult.topicsDiscussed,
    );

    this.resetCounter(conversationId);

    return {
      ...heuristicResult,
      memoryEntryId: memoryEntry?.id,
    };
  }

  /**
   * Generate a summary using AI.
   */
  private async generateAiSummary(
    messages: ConversationMessage[],
  ): Promise<{ summary: string; decisionsExtracted: string[]; topicsDiscussed: string[] } | null> {
    const availableProviders = this.aiService.getAvailableProviders();
    if (availableProviders.length === 0) {
      return null;
    }

    const provider = this.aiService.getProvider(availableProviders[0]);
    if (!provider) {
      return null;
    }

    try {
      const messagesText = messages
        .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
        .join('\n');

      const response = await provider.complete({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Summarize this conversation between a user and an AI coding assistant. 
Respond with ONLY a JSON object in this exact format:
{"summary": "1-3 sentence summary of the conversation", "decisions": ["decision 1", "decision 2"], "topics": ["topic 1", "topic 2"]}

Focus on: what was requested, what was decided, what code was generated.
Do not include any other text or markdown.`,
          },
          {
            role: 'user',
            content: messagesText,
          },
        ],
        temperature: 0.3,
        maxTokens: 300,
      });

      const parsed = this.parseSummaryResponse(response.content);
      return parsed;
    } catch (error) {
      this.logger.warn(`AI summarization failed: ${error}`);
      return null;
    }
  }

  /**
   * Parse AI summary response, handling JSON and markdown formatting.
   */
  private parseSummaryResponse(
    content: string,
  ): { summary: string; decisionsExtracted: string[]; topicsDiscussed: string[] } | null {
    let jsonStr = content.trim();

    // Strip markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      const lines = jsonStr.split('\n');
      lines.shift();
      if (lines[lines.length - 1]?.trim() === '```') {
        lines.pop();
      }
      jsonStr = lines.join('\n').trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        summary: parsed.summary || '',
        decisionsExtracted: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        topicsDiscussed: Array.isArray(parsed.topics) ? parsed.topics : [],
      };
    } catch {
      // If JSON parse fails, use the raw content as summary
      return {
        summary: content.slice(0, 200),
        decisionsExtracted: [],
        topicsDiscussed: [],
      };
    }
  }

  /**
   * Heuristic-based summarization when AI is not available.
   */
  heuristicSummarize(messages: ConversationMessage[]): {
    summary: string;
    decisionsExtracted: string[];
    topicsDiscussed: string[];
  } {
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    // Extract topics from user messages
    const topicsDiscussed: string[] = [];
    for (const msg of userMessages) {
      const firstSentence = msg.content.split(/[.!?\n]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 5 && firstSentence.length < 100) {
        topicsDiscussed.push(firstSentence);
      }
    }

    // Extract decisions from assistant messages with metadata
    const decisionsExtracted: string[] = [];
    for (const msg of assistantMessages) {
      if (msg.metadata?.intent && msg.metadata.intent !== 'general_question') {
        const filesChanged = msg.metadata.filesChanged as string[] | undefined;
        if (filesChanged && filesChanged.length > 0) {
          decisionsExtracted.push(
            `Generated ${filesChanged.length} file(s) for: ${(msg.metadata.intent as string).replace(/_/g, ' ')}`,
          );
        }
      }
    }

    // Build summary
    const parts: string[] = [];
    if (userMessages.length > 0) {
      parts.push(`Discussed ${userMessages.length} topic(s)`);
    }
    if (decisionsExtracted.length > 0) {
      parts.push(`made ${decisionsExtracted.length} code generation decision(s)`);
    }
    const summary = parts.length > 0
      ? `Conversation: ${parts.join(', ')}.`
      : 'Brief conversation with no significant decisions.';

    return {
      summary,
      decisionsExtracted: decisionsExtracted.slice(0, 5),
      topicsDiscussed: topicsDiscussed.slice(0, 5),
    };
  }

  /**
   * Store a conversation summary as a FEATURE_HISTORY memory entry.
   */
  private async storeConversationSummary(
    projectId: string,
    conversationId: string,
    summary: string,
    decisions: string[],
    topics: string[],
  ): Promise<{ id: string } | null> {
    try {
      const content = this.formatSummaryContent(summary, decisions, topics);

      const entry = await this.memoryService.create(projectId, {
        category: MemoryCategoryDto.FEATURE_HISTORY,
        title: `Conversation summary (${new Date().toISOString().split('T')[0]})`,
        content,
        tags: ['conversation-summary', 'auto-generated'],
        metadata: { conversationId, messageCount: topics.length + decisions.length },
      });

      return { id: entry.id };
    } catch (error) {
      this.logger.error(`Failed to store conversation summary: ${error}`);
      return null;
    }
  }

  /**
   * Format the summary content for storage.
   */
  private formatSummaryContent(
    summary: string,
    decisions: string[],
    topics: string[],
  ): string {
    const parts: string[] = [summary];

    if (decisions.length > 0) {
      parts.push(`\nDecisions: ${decisions.join('; ')}`);
    }

    if (topics.length > 0) {
      parts.push(`\nTopics: ${topics.join('; ')}`);
    }

    return parts.join('');
  }
}

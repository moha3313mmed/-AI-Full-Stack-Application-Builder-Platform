// ============================================================================
// MemoryContextBuilder - Formats memory entries for AI system prompts
// ============================================================================

import { MemoryCategory, type MemorySearchResult, type ProjectMemoryEntry } from './types.js';

/**
 * MemoryContextBuilder formats project memory entries into structured text
 * suitable for injection into AI system prompts. Includes token budget awareness
 * to prevent exceeding context limits.
 */
export class MemoryContextBuilder {
  /**
   * Approximate tokens per character ratio for estimation.
   * English text averages ~4 characters per token.
   */
  private static readonly CHARS_PER_TOKEN = 4;

  /**
   * Build context string from architecture-related entries.
   */
  buildArchitectureContext(entries: ProjectMemoryEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    const lines: string[] = ['## Architecture Decisions', ''];
    for (const entry of entries) {
      lines.push(`### ${entry.title}`);
      lines.push(entry.content);
      if (entry.metadata['rationale']) {
        lines.push(`**Rationale:** ${entry.metadata['rationale']}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build context string from coding standards entries.
   */
  buildCodingStandardsContext(entries: ProjectMemoryEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    const lines: string[] = ['## Coding Standards', ''];
    for (const entry of entries) {
      lines.push(`- **${entry.title}**`);
      if (entry.metadata['examples'] && Array.isArray(entry.metadata['examples'])) {
        for (const example of entry.metadata['examples'] as string[]) {
          lines.push(`  - Example: ${example}`);
        }
      }
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build a full context string from all memory entries grouped by category.
   */
  buildFullContext(entries: ProjectMemoryEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    // Group entries by category
    const grouped = new Map<MemoryCategory, ProjectMemoryEntry[]>();
    for (const entry of entries) {
      const existing = grouped.get(entry.category) ?? [];
      existing.push(entry);
      grouped.set(entry.category, existing);
    }

    const sections: string[] = ['# Project Context', ''];

    const categoryLabels: Record<MemoryCategory, string> = {
      [MemoryCategory.ARCHITECTURE]: 'Architecture',
      [MemoryCategory.CODING_STANDARDS]: 'Coding Standards',
      [MemoryCategory.USER_PREFERENCES]: 'User Preferences',
      [MemoryCategory.FEATURE_HISTORY]: 'Feature History',
      [MemoryCategory.BUSINESS_RULES]: 'Business Rules',
      [MemoryCategory.DESIGN_LANGUAGE]: 'Design Language',
      [MemoryCategory.DATABASE_EVOLUTION]: 'Database Evolution',
      [MemoryCategory.DECISIONS]: 'Decisions',
    };

    for (const [category, categoryEntries] of grouped) {
      sections.push(`## ${categoryLabels[category]}`);
      sections.push('');
      for (const entry of categoryEntries) {
        sections.push(`### ${entry.title}`);
        sections.push(entry.content);
        sections.push('');
      }
    }

    return sections.join('\n');
  }

  /**
   * Build context from search results, respecting a token budget.
   * Truncates content if the total exceeds the specified maxTokens.
   */
  buildRelevantContext(
    query: string,
    entries: MemorySearchResult[],
    maxTokens: number = 2000,
  ): string {
    if (entries.length === 0) {
      return '';
    }

    const maxChars = maxTokens * MemoryContextBuilder.CHARS_PER_TOKEN;
    const header = `# Relevant Context for: ${query}\n\n`;
    let result = header;
    let currentLength = header.length;

    for (const { entry, relevanceScore } of entries) {
      const section = this.formatEntrySection(entry, relevanceScore);
      const sectionLength = section.length;

      if (currentLength + sectionLength > maxChars) {
        // Try to fit a truncated version
        const remainingChars = maxChars - currentLength;
        if (remainingChars > 100) {
          result += section.slice(0, remainingChars - 4) + '...\n';
        }
        break;
      }

      result += section;
      currentLength += sectionLength;
    }

    return result;
  }

  /**
   * Estimate the number of tokens in a string.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / MemoryContextBuilder.CHARS_PER_TOKEN);
  }

  private formatEntrySection(entry: ProjectMemoryEntry, relevanceScore: number): string {
    const lines: string[] = [];
    lines.push(`### ${entry.title} (relevance: ${relevanceScore.toFixed(2)})`);
    lines.push(`Category: ${entry.category}`);
    if (entry.tags.length > 0) {
      lines.push(`Tags: ${entry.tags.join(', ')}`);
    }
    lines.push('');
    lines.push(entry.content);
    lines.push('');
    return lines.join('\n');
  }
}

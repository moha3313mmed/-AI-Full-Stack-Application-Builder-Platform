import { Injectable, Logger } from '@nestjs/common';

import { AiService } from '../ai/ai.service';

import { MemoryCategoryDto } from './dto/create-memory.dto';
import { MemoryService } from './memory.service';

/**
 * Extracted pattern from generated code.
 */
export interface ExtractedPattern {
  category: MemoryCategoryDto;
  title: string;
  content: string;
  tags: string[];
}

/**
 * MemoryExtractor analyzes generated code and user interactions to
 * automatically extract architectural patterns, technology decisions,
 * and coding conventions, storing them as categorized memory entries.
 */
@Injectable()
export class MemoryExtractor {
  private readonly logger = new Logger(MemoryExtractor.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Analyze generated code and extract patterns to store as memory entries.
   */
  async extractFromGeneratedCode(
    projectId: string,
    filesChanged: string[],
    codeSnippets: Record<string, string>,
    description: string,
  ): Promise<ExtractedPattern[]> {
    const patterns: ExtractedPattern[] = [];

    // Extract architecture patterns from file structure
    const architecturePatterns = this.extractArchitecturePatterns(filesChanged, codeSnippets);
    patterns.push(...architecturePatterns);

    // Extract technology decisions
    const techDecisions = this.extractTechnologyDecisions(codeSnippets);
    patterns.push(...techDecisions);

    // Extract coding conventions
    const conventions = this.extractCodingConventions(codeSnippets);
    patterns.push(...conventions);

    // Use AI summarization if available
    const aiSummary = await this.generateAiSummary(projectId, description, filesChanged, codeSnippets);
    if (aiSummary) {
      patterns.push(aiSummary);
    }

    // Store all extracted patterns
    for (const pattern of patterns) {
      try {
        await this.memoryService.create(projectId, {
          category: pattern.category,
          title: pattern.title,
          content: pattern.content,
          tags: pattern.tags,
        });
      } catch (error) {
        this.logger.warn(`Failed to store pattern "${pattern.title}": ${error}`);
      }
    }

    return patterns;
  }

  /**
   * Extract architectural patterns from file paths and structure.
   */
  extractArchitecturePatterns(
    filesChanged: string[],
    codeSnippets: Record<string, string>,
  ): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];

    // Detect framework patterns from file paths
    const hasPages = filesChanged.some((f) => f.includes('/pages/') || f.includes('/app/'));
    const hasComponents = filesChanged.some((f) => f.includes('/components/'));
    const hasApi = filesChanged.some((f) => f.includes('/api/') || f.includes('/routes/'));
    const _hasSrc = filesChanged.some((f) => f.startsWith('/src/'));

    if (hasPages && hasComponents) {
      patterns.push({
        category: MemoryCategoryDto.ARCHITECTURE,
        title: 'Page-based routing with component architecture',
        content: 'Project uses page-based routing with reusable components separated into a /components directory.',
        tags: ['architecture', 'routing', 'components'],
      });
    }

    if (hasApi) {
      patterns.push({
        category: MemoryCategoryDto.ARCHITECTURE,
        title: 'API layer structure',
        content: 'Project includes a dedicated API layer for server-side endpoints.',
        tags: ['architecture', 'api', 'backend'],
      });
    }

    // Detect patterns from code content
    const allCode = Object.values(codeSnippets).join('\n');

    if (allCode.includes('useQuery') || allCode.includes('react-query') || allCode.includes('@tanstack/react-query')) {
      patterns.push({
        category: MemoryCategoryDto.ARCHITECTURE,
        title: 'React Query for data fetching',
        content: 'Project uses React Query (TanStack Query) for server state management and data fetching.',
        tags: ['architecture', 'data-fetching', 'react-query'],
      });
    }

    if (allCode.includes('createContext') || allCode.includes('useContext')) {
      patterns.push({
        category: MemoryCategoryDto.ARCHITECTURE,
        title: 'React Context for state management',
        content: 'Project uses React Context API for application state management.',
        tags: ['architecture', 'state-management', 'context'],
      });
    }

    return patterns;
  }

  /**
   * Extract technology decisions from code content.
   */
  extractTechnologyDecisions(
    codeSnippets: Record<string, string>,
  ): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];
    const allCode = Object.values(codeSnippets).join('\n');
    const detectedTech: string[] = [];

    // Framework detection
    if (allCode.includes('from "next') || allCode.includes("from 'next")) {
      detectedTech.push('Next.js');
    }
    if (allCode.includes('from "react') || allCode.includes("from 'react")) {
      detectedTech.push('React');
    }
    if (allCode.includes('from "express') || allCode.includes("from 'express")) {
      detectedTech.push('Express');
    }
    if (allCode.includes('@nestjs/')) {
      detectedTech.push('NestJS');
    }

    // Styling detection
    if (allCode.includes('tailwind') || allCode.includes('className="') || allCode.includes("className='")) {
      detectedTech.push('Tailwind CSS');
    }
    if (allCode.includes('styled-components') || allCode.includes('styled.')) {
      detectedTech.push('Styled Components');
    }

    // Testing detection
    if (allCode.includes('@testing-library') || allCode.includes('render(')) {
      detectedTech.push('Testing Library');
    }

    if (detectedTech.length > 0) {
      patterns.push({
        category: MemoryCategoryDto.DECISIONS,
        title: 'Technology stack decisions',
        content: `Project uses the following technologies: ${detectedTech.join(', ')}.`,
        tags: ['technology', 'stack', ...detectedTech.map((t) => t.toLowerCase().replace(/\s+/g, '-'))],
      });
    }

    return patterns;
  }

  /**
   * Extract coding conventions from code content.
   */
  extractCodingConventions(
    codeSnippets: Record<string, string>,
  ): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];
    const allCode = Object.values(codeSnippets).join('\n');

    // Detect TypeScript vs JavaScript
    const hasTypeAnnotations = allCode.includes(': string') || allCode.includes(': number') || allCode.includes('interface ');
    if (hasTypeAnnotations) {
      patterns.push({
        category: MemoryCategoryDto.CODING_STANDARDS,
        title: 'TypeScript with explicit type annotations',
        content: 'Project uses TypeScript with explicit type annotations for function parameters and return types.',
        tags: ['coding-standards', 'typescript', 'types'],
      });
    }

    // Detect export style
    const hasDefaultExports = allCode.includes('export default');
    const hasNamedExports = allCode.includes('export {') || allCode.includes('export const') || allCode.includes('export function');
    if (hasNamedExports && !hasDefaultExports) {
      patterns.push({
        category: MemoryCategoryDto.CODING_STANDARDS,
        title: 'Named exports preferred',
        content: 'Project prefers named exports over default exports for better refactoring support.',
        tags: ['coding-standards', 'exports', 'modules'],
      });
    }

    // Detect arrow functions vs function declarations
    const arrowFnCount = (allCode.match(/=>\s*{/g) || []).length;
    const functionDeclCount = (allCode.match(/function\s+\w+/g) || []).length;
    if (arrowFnCount > functionDeclCount * 2) {
      patterns.push({
        category: MemoryCategoryDto.CODING_STANDARDS,
        title: 'Arrow functions preferred',
        content: 'Project predominantly uses arrow function expressions over function declarations.',
        tags: ['coding-standards', 'functions', 'arrow-functions'],
      });
    }

    return patterns;
  }

  /**
   * Use AI to generate a concise summary of what was done and why.
   */
  private async generateAiSummary(
    projectId: string,
    description: string,
    filesChanged: string[],
    codeSnippets: Record<string, string>,
  ): Promise<ExtractedPattern | null> {
    const availableProviders = this.aiService.getAvailableProviders();
    if (availableProviders.length === 0) {
      return null;
    }

    const provider = this.aiService.getProvider(availableProviders[0]);
    if (!provider) {
      return null;
    }

    try {
      // Limit code snippets to avoid exceeding token limits
      const snippetSummary = Object.entries(codeSnippets)
        .slice(0, 5)
        .map(([path, code]) => `${path}:\n${code.slice(0, 200)}`)
        .join('\n\n');

      const response = await provider.complete({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a code analyst. Summarize the following code changes in 1-2 sentences, focusing on the architectural decision or pattern being implemented. Respond with ONLY the summary text, no formatting.',
          },
          {
            role: 'user',
            content: `Description: ${description}\nFiles changed: ${filesChanged.join(', ')}\n\nCode samples:\n${snippetSummary}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 150,
      });

      return {
        category: MemoryCategoryDto.FEATURE_HISTORY,
        title: `Feature: ${description.slice(0, 80)}`,
        content: response.content,
        tags: ['feature-history', 'auto-extracted'],
      };
    } catch (error) {
      this.logger.warn(`AI summary generation failed: ${error}`);
      return null;
    }
  }
}

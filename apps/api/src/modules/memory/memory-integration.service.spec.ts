import { Test, TestingModule } from '@nestjs/testing';

import { ConversationSummarizer } from './conversation-summarizer';
import { MemoryExtractor } from './memory-extractor';
import { MemoryIntegrationService } from './memory-integration.service';
import { MemoryService } from './memory.service';

describe('MemoryIntegrationService', () => {
  let service: MemoryIntegrationService;

  const mockMemoryService = {
    getProjectContext: jest.fn(),
    listByProject: jest.fn(),
    create: jest.fn(),
    getByCategory: jest.fn(),
  };

  const mockMemoryExtractor = {
    extractFromGeneratedCode: jest.fn().mockResolvedValue([]),
  };

  const mockConversationSummarizer = {
    shouldSummarize: jest.fn().mockReturnValue(false),
    summarize: jest.fn().mockResolvedValue({
      summary: 'Test summary',
      decisionsExtracted: [],
      topicsDiscussed: [],
      memoryEntryId: 'mem-1',
    }),
    resetCounter: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryIntegrationService,
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: MemoryExtractor, useValue: mockMemoryExtractor },
        { provide: ConversationSummarizer, useValue: mockConversationSummarizer },
      ],
    }).compile();

    service = module.get<MemoryIntegrationService>(MemoryIntegrationService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loadContext', () => {
    it('should load project context from memory service', async () => {
      const contextString = '# Project Context\n\n## ARCHITECTURE\n- REST API: Uses Express with modular routing';
      mockMemoryService.getProjectContext.mockResolvedValue(contextString);

      const result = await service.loadContext('project-1');

      expect(mockMemoryService.getProjectContext).toHaveBeenCalledWith('project-1');
      expect(result.contextString).toBe(contextString);
      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.entryCount).toBe(1); // One line starting with "- "
    });

    it('should return empty context when no memory exists', async () => {
      mockMemoryService.getProjectContext.mockResolvedValue('No project context available.');

      const result = await service.loadContext('project-1');

      expect(result.contextString).toBe('No project context available.');
      expect(result.entryCount).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockMemoryService.getProjectContext.mockRejectedValue(new Error('DB error'));

      const result = await service.loadContext('project-1');

      expect(result.contextString).toBe('');
      expect(result.entryCount).toBe(0);
      expect(result.estimatedTokens).toBe(0);
    });
  });

  describe('storeOutcome', () => {
    it('should call memory extractor with generation outcome', async () => {
      const outcome = {
        description: 'Create a login form',
        filesChanged: ['/src/Login.tsx', '/src/auth.ts'],
        codeSnippets: { '/src/Login.tsx': 'export function Login() {}' },
        intent: 'add_feature',
      };

      await service.storeOutcome('project-1', outcome);

      expect(mockMemoryExtractor.extractFromGeneratedCode).toHaveBeenCalledWith(
        'project-1',
        outcome.filesChanged,
        outcome.codeSnippets,
        outcome.description,
      );
    });

    it('should not throw when extraction fails', async () => {
      mockMemoryExtractor.extractFromGeneratedCode.mockRejectedValue(new Error('Extraction failed'));

      await expect(
        service.storeOutcome('project-1', {
          description: 'test',
          filesChanged: [],
          codeSnippets: {},
          intent: 'create_project',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('trackMessage', () => {
    it('should trigger summarization when threshold is reached', async () => {
      mockConversationSummarizer.shouldSummarize.mockReturnValue(true);
      mockConversationSummarizer.summarize.mockResolvedValue({
        summary: 'Summary',
        decisionsExtracted: [],
        topicsDiscussed: [],
        memoryEntryId: 'mem-1',
      });
      const messages = [
        { role: 'user', content: 'Create a login page' },
        { role: 'assistant', content: 'Done!' },
      ];

      await service.trackMessage('project-1', 'conv-1', messages);

      expect(mockConversationSummarizer.summarize).toHaveBeenCalledWith(
        'project-1',
        'conv-1',
        messages,
      );
    });

    it('should not trigger summarization below threshold', async () => {
      mockConversationSummarizer.shouldSummarize.mockReturnValue(false);

      await service.trackMessage('project-1', 'conv-1', []);

      expect(mockConversationSummarizer.summarize).not.toHaveBeenCalled();
    });

    it('should handle summarization errors gracefully', async () => {
      mockConversationSummarizer.shouldSummarize.mockReturnValue(true);
      mockConversationSummarizer.summarize.mockRejectedValue(new Error('AI failed'));

      await expect(
        service.trackMessage('project-1', 'conv-1', [{ role: 'user', content: 'test' }]),
      ).resolves.not.toThrow();
    });
  });

  describe('triggerSummarization', () => {
    it('should manually trigger conversation summarization', async () => {
      mockConversationSummarizer.summarize.mockResolvedValue({
        summary: 'Test summary',
        decisionsExtracted: [],
        topicsDiscussed: [],
        memoryEntryId: 'mem-1',
      });

      const messages = [
        { role: 'user', content: 'Build a dashboard' },
        { role: 'assistant', content: 'Created dashboard with charts' },
      ];

      const result = await service.triggerSummarization('project-1', 'conv-1', messages);

      expect(mockConversationSummarizer.summarize).toHaveBeenCalledWith(
        'project-1',
        'conv-1',
        messages,
      );
      expect(result.summary).toBe('Test summary');
      expect(result.stored).toBe(true);
    });

    it('should return empty result on failure', async () => {
      mockConversationSummarizer.summarize.mockRejectedValue(new Error('Failed'));

      const result = await service.triggerSummarization('project-1', 'conv-1', []);

      expect(result.summary).toBe('');
      expect(result.stored).toBe(false);
    });
  });

  describe('hydrateProjectContext', () => {
    it('should load full project context', async () => {
      const contextString = '# Project Context\n\n## ARCHITECTURE\n- Uses NestJS';
      mockMemoryService.getProjectContext.mockResolvedValue(contextString);

      const result = await service.hydrateProjectContext('project-1');

      expect(result.contextString).toBe(contextString);
      expect(result.estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics by category', async () => {
      mockMemoryService.listByProject.mockResolvedValue({
        items: [
          { category: 'ARCHITECTURE', title: 'REST API', content: 'Uses Express' },
          { category: 'ARCHITECTURE', title: 'Monorepo', content: 'Uses Turborepo' },
          { category: 'CODING_STANDARDS', title: 'TypeScript', content: 'Strict mode' },
        ],
        total: 3,
      });

      const stats = await service.getMemoryStats('project-1');

      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesByCategory['ARCHITECTURE']).toBe(2);
      expect(stats.entriesByCategory['CODING_STANDARDS']).toBe(1);
      expect(stats.estimatedTotalTokens).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      mockMemoryService.listByProject.mockRejectedValue(new Error('DB error'));

      const stats = await service.getMemoryStats('project-1');

      expect(stats.totalEntries).toBe(0);
      expect(stats.entriesByCategory).toEqual({});
      expect(stats.estimatedTotalTokens).toBe(0);
    });
  });
});

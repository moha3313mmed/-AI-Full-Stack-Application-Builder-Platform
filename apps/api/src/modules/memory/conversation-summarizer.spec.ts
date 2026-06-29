import { Test, TestingModule } from '@nestjs/testing';

import { AiService } from '../ai/ai.service';

import { ConversationSummarizer } from './conversation-summarizer';
import { MemoryService } from './memory.service';

describe('ConversationSummarizer', () => {
  let service: ConversationSummarizer;

  const mockMemoryService = {
    create: jest.fn().mockResolvedValue({ id: 'mem-1' }),
  };

  const mockAiProvider = {
    complete: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'User requested a login page. AI generated a React component with form validation.',
        decisions: ['Used React Hook Form for validation', 'Added email and password fields'],
        topics: ['Login page implementation', 'Form validation'],
      }),
    }),
  };

  const mockAiService = {
    getAvailableProviders: jest.fn().mockReturnValue(['openai']),
    getProvider: jest.fn().mockReturnValue(mockAiProvider),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationSummarizer,
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<ConversationSummarizer>(ConversationSummarizer);
    jest.clearAllMocks();

    // Re-setup default mocks
    mockAiService.getAvailableProviders.mockReturnValue(['openai']);
    mockAiService.getProvider.mockReturnValue(mockAiProvider);
    mockMemoryService.create.mockResolvedValue({ id: 'mem-1' });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('shouldSummarize', () => {
    it('should return false below threshold', () => {
      expect(service.shouldSummarize('conv-1')).toBe(false);
      expect(service.shouldSummarize('conv-1')).toBe(false);
      expect(service.shouldSummarize('conv-1')).toBe(false);
      expect(service.shouldSummarize('conv-1')).toBe(false);
    });

    it('should return true at threshold (5 messages)', () => {
      service.shouldSummarize('conv-1'); // 1
      service.shouldSummarize('conv-1'); // 2
      service.shouldSummarize('conv-1'); // 3
      service.shouldSummarize('conv-1'); // 4
      const result = service.shouldSummarize('conv-1'); // 5

      expect(result).toBe(true);
    });

    it('should track separate conversations independently', () => {
      service.shouldSummarize('conv-1'); // conv-1: 1
      service.shouldSummarize('conv-1'); // conv-1: 2
      service.shouldSummarize('conv-2'); // conv-2: 1

      expect(service.getMessageCount('conv-1')).toBe(2);
      expect(service.getMessageCount('conv-2')).toBe(1);
    });
  });

  describe('resetCounter', () => {
    it('should reset message counter for a conversation', () => {
      service.shouldSummarize('conv-1');
      service.shouldSummarize('conv-1');
      service.shouldSummarize('conv-1');

      service.resetCounter('conv-1');

      expect(service.getMessageCount('conv-1')).toBe(0);
    });
  });

  describe('summarize', () => {
    it('should generate AI summary when provider available', async () => {
      const messages = [
        { role: 'user', content: 'Create a login page for my app' },
        { role: 'assistant', content: 'I created a login page with email and password fields.' },
        { role: 'user', content: 'Add form validation' },
        { role: 'assistant', content: 'Added React Hook Form validation.' },
      ];

      const result = await service.summarize('project-1', 'conv-1', messages);

      expect(result.summary).toContain('login page');
      expect(result.decisionsExtracted.length).toBeGreaterThan(0);
      expect(result.topicsDiscussed.length).toBeGreaterThan(0);
      expect(result.memoryEntryId).toBe('mem-1');
    });

    it('should store summary as FEATURE_HISTORY memory entry', async () => {
      const messages = [
        { role: 'user', content: 'Build a dashboard' },
        { role: 'assistant', content: 'Dashboard created.' },
      ];

      await service.summarize('project-1', 'conv-1', messages);

      expect(mockMemoryService.create).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          category: 'FEATURE_HISTORY',
          tags: expect.arrayContaining(['conversation-summary', 'auto-generated']),
        }),
      );
    });

    it('should use heuristic summarization when no AI provider available', async () => {
      mockAiService.getAvailableProviders.mockReturnValue([]);

      const messages = [
        { role: 'user', content: 'Create a login page for my app' },
        { role: 'assistant', content: 'Done!', metadata: { intent: 'create_project', filesChanged: ['/src/Login.tsx'] } },
      ];

      const result = await service.summarize('project-1', 'conv-1', messages);

      expect(result.summary).toBeTruthy();
      expect(result.memoryEntryId).toBe('mem-1');
    });

    it('should return empty result for empty messages', async () => {
      const result = await service.summarize('project-1', 'conv-1', []);

      expect(result.summary).toBe('');
      expect(result.decisionsExtracted).toEqual([]);
      expect(result.topicsDiscussed).toEqual([]);
    });

    it('should reset counter after summarization', async () => {
      // Manually set counter to 5
      for (let i = 0; i < 5; i++) {
        service.shouldSummarize('conv-1');
      }
      expect(service.getMessageCount('conv-1')).toBe(5);

      await service.summarize('project-1', 'conv-1', [
        { role: 'user', content: 'test' },
      ]);

      expect(service.getMessageCount('conv-1')).toBe(0);
    });

    it('should handle AI response parse failure gracefully', async () => {
      mockAiProvider.complete.mockResolvedValue({ content: 'not valid json' });

      const messages = [
        { role: 'user', content: 'Build something' },
        { role: 'assistant', content: 'Built it.' },
      ];

      const result = await service.summarize('project-1', 'conv-1', messages);

      // Should fall back to using raw content as summary
      expect(result.summary).toBeTruthy();
      expect(result.memoryEntryId).toBe('mem-1');
    });
  });

  describe('heuristicSummarize', () => {
    it('should extract topics from user messages', () => {
      const messages = [
        { role: 'user', content: 'Build a navigation bar for the site' },
        { role: 'assistant', content: 'Created the nav bar component.' },
        { role: 'user', content: 'Add dropdown menus to it' },
        { role: 'assistant', content: 'Dropdown menus added.' },
      ];

      const result = service.heuristicSummarize(messages);

      expect(result.topicsDiscussed.length).toBeGreaterThan(0);
      expect(result.summary).toContain('Discussed');
    });

    it('should extract decisions from assistant metadata', () => {
      const messages = [
        { role: 'user', content: 'Create a dashboard' },
        {
          role: 'assistant',
          content: 'Dashboard created.',
          metadata: { intent: 'create_project', filesChanged: ['/src/Dashboard.tsx', '/src/widgets/Chart.tsx'] },
        },
      ];

      const result = service.heuristicSummarize(messages);

      expect(result.decisionsExtracted.length).toBeGreaterThan(0);
      expect(result.decisionsExtracted[0]).toContain('2 file(s)');
    });

    it('should handle conversations with no significant content', () => {
      const messages = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ];

      const result = service.heuristicSummarize(messages);

      expect(result.summary).toBeTruthy();
    });
  });
});

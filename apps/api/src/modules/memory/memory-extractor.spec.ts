import { Test, TestingModule } from '@nestjs/testing';

import { AiService } from '../ai/ai.service';

import { MemoryExtractor } from './memory-extractor';
import { MemoryService } from './memory.service';

describe('MemoryExtractor', () => {
  let service: MemoryExtractor;

  const mockMemoryService = {
    create: jest.fn().mockResolvedValue({ id: 'mem-1' }),
  };

  const mockAiProvider = {
    complete: jest.fn().mockResolvedValue({
      content: 'Implemented a login form with email/password authentication using React Hook Form.',
    }),
  };

  const mockAiService = {
    getAvailableProviders: jest.fn().mockReturnValue(['openai']),
    getProvider: jest.fn().mockReturnValue(mockAiProvider),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryExtractor,
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<MemoryExtractor>(MemoryExtractor);
    jest.clearAllMocks();

    // Re-setup default mocks after clear
    mockAiService.getAvailableProviders.mockReturnValue(['openai']);
    mockAiService.getProvider.mockReturnValue(mockAiProvider);
    mockMemoryService.create.mockResolvedValue({ id: 'mem-1' });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractArchitecturePatterns', () => {
    it('should detect page-based routing with components', () => {
      const files = ['/pages/index.tsx', '/components/Header.tsx'];
      const snippets = { '/pages/index.tsx': 'export default function Home() {}' };

      const patterns = service.extractArchitecturePatterns(files, snippets);

      expect(patterns.some((p) => p.title.includes('Page-based routing'))).toBe(true);
    });

    it('should detect API layer structure', () => {
      const files = ['/src/api/users.ts', '/src/components/UserList.tsx'];
      const snippets = {};

      const patterns = service.extractArchitecturePatterns(files, snippets);

      expect(patterns.some((p) => p.title.includes('API layer'))).toBe(true);
    });

    it('should detect React Query usage', () => {
      const files = ['/src/hooks/useUsers.ts'];
      const snippets = {
        '/src/hooks/useUsers.ts': 'import { useQuery } from "@tanstack/react-query";\nexport const useUsers = () => useQuery(["users"], fetchUsers);',
      };

      const patterns = service.extractArchitecturePatterns(files, snippets);

      expect(patterns.some((p) => p.title.includes('React Query'))).toBe(true);
    });

    it('should detect React Context usage', () => {
      const files = ['/src/context/AuthContext.tsx'];
      const snippets = {
        '/src/context/AuthContext.tsx': 'const AuthContext = createContext(null);\nexport const useAuth = () => useContext(AuthContext);',
      };

      const patterns = service.extractArchitecturePatterns(files, snippets);

      expect(patterns.some((p) => p.title.includes('React Context'))).toBe(true);
    });

    it('should return empty for non-matching patterns', () => {
      const files = ['/README.md'];
      const snippets = { '/README.md': '# My Project' };

      const patterns = service.extractArchitecturePatterns(files, snippets);

      expect(patterns.length).toBe(0);
    });
  });

  describe('extractTechnologyDecisions', () => {
    it('should detect Next.js', () => {
      const snippets = { '/pages/index.tsx': 'import Head from "next/head"' };

      const patterns = service.extractTechnologyDecisions(snippets);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].content).toContain('Next.js');
    });

    it('should detect multiple technologies', () => {
      const snippets = {
        '/src/App.tsx': 'import React from "react";\nimport { useQuery } from "@tanstack/react-query";',
        '/tailwind.config.js': 'module.exports = { content: [] }',
        '/src/api.ts': 'import express from "express";',
      };

      const patterns = service.extractTechnologyDecisions(snippets);

      expect(patterns.length).toBeGreaterThan(0);
      const content = patterns[0].content;
      expect(content).toContain('React');
      expect(content).toContain('Express');
    });

    it('should return empty when no known technologies detected', () => {
      const snippets = { '/README.md': '# Just a readme file' };

      const patterns = service.extractTechnologyDecisions(snippets);

      expect(patterns.length).toBe(0);
    });
  });

  describe('extractCodingConventions', () => {
    it('should detect TypeScript type annotations', () => {
      const snippets = {
        '/src/utils.ts': 'export function add(a: number, b: number): number { return a + b; }',
      };

      const patterns = service.extractCodingConventions(snippets);

      expect(patterns.some((p) => p.title.includes('TypeScript'))).toBe(true);
    });

    it('should detect named exports preference', () => {
      const snippets = {
        '/src/utils.ts': 'export const add = (a, b) => a + b;\nexport const sub = (a, b) => a - b;',
        '/src/helpers.ts': 'export function multiply(a, b) { return a * b; }',
      };

      const patterns = service.extractCodingConventions(snippets);

      expect(patterns.some((p) => p.title.includes('Named exports'))).toBe(true);
    });

    it('should detect arrow function preference', () => {
      const snippets = {
        '/src/handlers.ts': [
          'const handler1 = () => { return 1; }',
          'const handler2 = () => { return 2; }',
          'const handler3 = () => { return 3; }',
          'const handler4 = () => { return 4; }',
          'const handler5 = () => { return 5; }',
          'function singleDecl() { return 0; }',
        ].join('\n'),
      };

      const patterns = service.extractCodingConventions(snippets);

      expect(patterns.some((p) => p.title.includes('Arrow functions'))).toBe(true);
    });
  });

  describe('extractFromGeneratedCode', () => {
    it('should extract patterns and store them as memory entries', async () => {
      const filesChanged = ['/src/pages/index.tsx', '/src/components/Header.tsx'];
      const codeSnippets = {
        '/src/pages/index.tsx': 'import React from "react";\nexport default function Home() {}',
        '/src/components/Header.tsx': 'export const Header = () => { return <header />; }',
      };

      const patterns = await service.extractFromGeneratedCode(
        'project-1',
        filesChanged,
        codeSnippets,
        'Create a landing page',
      );

      expect(patterns.length).toBeGreaterThan(0);
      expect(mockMemoryService.create).toHaveBeenCalled();
    });

    it('should include AI summary when provider is available', async () => {
      const patterns = await service.extractFromGeneratedCode(
        'project-1',
        ['/src/App.tsx'],
        { '/src/App.tsx': 'const App = () => <div />;\nexport default App;' },
        'Create a simple app',
      );

      // AI summary is the last pattern (FEATURE_HISTORY)
      const featurePatterns = patterns.filter((p) => p.category === 'FEATURE_HISTORY');
      expect(featurePatterns.length).toBe(1);
      expect(featurePatterns[0].content).toContain('login form');
    });

    it('should work without AI provider', async () => {
      mockAiService.getAvailableProviders.mockReturnValue([]);

      const patterns = await service.extractFromGeneratedCode(
        'project-1',
        ['/src/App.tsx'],
        { '/src/App.tsx': 'import React from "react";\nexport default function App() {}' },
        'Create app',
      );

      // Should still extract heuristic patterns
      expect(patterns.length).toBeGreaterThan(0);
      // No FEATURE_HISTORY from AI since no provider
      const aiPatterns = patterns.filter(
        (p) => p.category === 'FEATURE_HISTORY' && p.tags.includes('auto-extracted'),
      );
      expect(aiPatterns.length).toBe(0);
    });

    it('should handle memory service failures gracefully', async () => {
      mockMemoryService.create.mockRejectedValue(new Error('DB error'));

      // Should not throw even if create fails
      await expect(
        service.extractFromGeneratedCode(
          'project-1',
          ['/src/App.tsx'],
          { '/src/App.tsx': 'import React from "react";' },
          'test',
        ),
      ).resolves.toBeDefined();
    });
  });
});

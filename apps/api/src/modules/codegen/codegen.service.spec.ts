import { Test, TestingModule } from '@nestjs/testing';

import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';

import { CodegenService } from './codegen.service';

describe('CodegenService', () => {
  let service: CodegenService;

  const mockProvider = {
    complete: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        operations: [
          { type: 'create', path: '/src/hello.ts', content: 'export const hello = "world";' },
        ],
        explanation: 'Created a hello module',
      }),
    }),
  };

  const mockAiService = {
    getAvailableProviders: jest.fn().mockReturnValue(['openai']),
    getProvider: jest.fn().mockReturnValue(mockProvider),
  };

  const mockFilesService = {
    getProjectFS: jest.fn(),
    createFile: jest.fn().mockReturnValue({ path: '/src/hello.ts', content: { text: '' } }),
    readFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
    moveFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodegenService,
        { provide: AiService, useValue: mockAiService },
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();

    service = module.get<CodegenService>(CodegenService);
    jest.clearAllMocks();

    // Reset default mock implementations after clearAllMocks
    mockAiService.getAvailableProviders.mockReturnValue(['openai']);
    mockAiService.getProvider.mockReturnValue(mockProvider);
    mockProvider.complete.mockResolvedValue({
      content: JSON.stringify({
        operations: [
          { type: 'create', path: '/src/hello.ts', content: 'export const hello = "world";' },
        ],
        explanation: 'Created a hello module',
      }),
    });
    mockFilesService.createFile.mockReturnValue({ path: '/src/hello.ts', content: { text: '' } });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCode', () => {
    it('should generate code and apply operations', async () => {
      const result = await service.generateCode('project-1', {
        description: 'Create a hello world module',
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.explanation).toBe('Created a hello module');
      expect(mockFilesService.createFile).toHaveBeenCalledWith(
        'project-1',
        '/src/hello.ts',
        'export const hello = "world";',
        undefined,
      );
    });

    it('should pass framework to code generator', async () => {
      await service.generateCode('project-1', {
        description: 'Create a page',
        framework: 'nextjs',
      });

      expect(mockProvider.complete).toHaveBeenCalled();
    });

    it('should handle generation failure', async () => {
      mockProvider.complete.mockResolvedValue({
        content: 'invalid json response',
      });

      const result = await service.generateCode('project-1', {
        description: 'This will fail',
      });

      expect(result.success).toBe(false);
    });

    it('should throw when no AI provider is available', async () => {
      mockAiService.getAvailableProviders.mockReturnValue([]);

      await expect(
        service.generateCode('project-1', {
          description: 'Generate something',
        }),
      ).rejects.toThrow('No AI provider available for code generation');
    });

    it('should record history entry on successful generation', async () => {
      await service.generateCode('project-1', {
        description: 'Create something',
      });

      const history = service.getHistory('project-1');
      expect(history).toHaveLength(1);
      expect(history[0].description).toBe('Create something');
      expect(history[0].success).toBe(true);
    });
  });

  describe('modifyCode', () => {
    it('should modify existing code', async () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/src/app.ts',
        content: { text: 'const app = {};', language: 'typescript' },
      });

      mockProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          operations: [
            { type: 'update', path: '/src/app.ts', content: 'const app = { name: "test" };' },
          ],
          explanation: 'Added name property',
        }),
      });

      const result = await service.modifyCode('project-1', {
        description: 'Add name property',
        filePath: '/src/app.ts',
        instruction: 'Add a name field',
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
    });

    it('should handle modification failure gracefully', async () => {
      mockFilesService.readFile.mockImplementation(() => {
        throw new Error('File not found');
      });

      mockProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          operations: [],
          explanation: 'No changes needed',
        }),
      });

      const result = await service.modifyCode('project-1', {
        description: 'Modify something',
        filePath: '/missing.ts',
        instruction: 'Do something',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return empty array for projects with no history', () => {
      const history = service.getHistory('no-history-project');
      expect(history).toEqual([]);
    });

    it('should accumulate history entries', async () => {
      await service.generateCode('project-1', { description: 'First' });
      await service.generateCode('project-1', { description: 'Second' });

      const history = service.getHistory('project-1');
      expect(history).toHaveLength(2);
      expect(history[0].description).toBe('First');
      expect(history[1].description).toBe('Second');
    });
  });
});

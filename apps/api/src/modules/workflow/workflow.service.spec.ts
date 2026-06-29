import { Test, TestingModule } from '@nestjs/testing';

import { AiService } from '../ai/ai.service';
import { CodegenService } from '../codegen/codegen.service';
import { ConversationsService } from '../conversations/conversations.service';
import { DeployService } from '../deploy/deploy.service';
import { FilesService } from '../files/files.service';
import { GitService } from '../git/git.service';
import { MemoryIntegrationService } from '../memory/memory-integration.service';

import { ParallelExecutionService } from './parallel-execution.service';
import { RecoveryService } from './recovery.service';
import { ValidationPipeline } from './validation-pipeline';
import { WorkflowGateway } from './workflow.gateway';
import { WorkflowService } from './workflow.service';

describe('WorkflowService', () => {
  let service: WorkflowService;

  const mockConversationsService = {
    addMessage: jest.fn().mockResolvedValue({ id: 'msg-1', content: 'test' }),
  };

  const mockAiProvider = {
    complete: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        intent: 'create_project',
        description: 'Create a landing page',
        parameters: {},
      }),
    }),
  };

  const mockAiService = {
    getAvailableProviders: jest.fn().mockReturnValue(['openai']),
    getProvider: jest.fn().mockReturnValue(mockAiProvider),
  };

  const mockCodegenService = {
    generateCode: jest.fn().mockResolvedValue({
      success: true,
      operations: [
        { type: 'create', path: '/src/App.tsx', content: 'export default function App() {}' },
        { type: 'create', path: '/src/index.ts', content: 'import App from "./App"' },
      ],
      explanation: 'Created the main App component',
    }),
    modifyCode: jest.fn().mockResolvedValue({
      success: true,
      operations: [
        { type: 'update', path: '/src/App.tsx', content: 'updated content' },
      ],
      explanation: 'Modified the App component',
    }),
  };

  const mockFilesService = {
    getTree: jest.fn().mockReturnValue({ fileCount: 2, files: [] }),
    listDirectory: jest.fn().mockReturnValue([
      { path: '/src/App.tsx', name: 'App.tsx', type: 'file' },
    ]),
    readFile: jest.fn().mockReturnValue({
      path: '/src/App.tsx',
      content: { text: 'export default function App() {}', language: 'typescriptreact' },
    }),
  };

  const mockGitService = {
    commit: jest.fn().mockResolvedValue({
      sha: 'abc123',
      message: 'Initial commit',
    }),
  };

  const mockDeployService = {
    create: jest.fn().mockResolvedValue({
      id: 'deploy-1',
      status: 'DEPLOYED',
      url: 'https://my-app.vercel.app',
    }),
  };

  const mockGateway = {
    emitWorkflowStarted: jest.fn(),
    emitWorkflowProgress: jest.fn(),
    emitWorkflowFilesUpdated: jest.fn(),
    emitWorkflowCompleted: jest.fn(),
    emitWorkflowError: jest.fn(),
    emitAgentStarted: jest.fn(),
    emitAgentProgress: jest.fn(),
    emitAgentCompleted: jest.fn(),
    emitPlanProgress: jest.fn(),
    emitRollbackStarted: jest.fn(),
    emitRollbackCompleted: jest.fn(),
    emitRetryStarted: jest.fn(),
    emitValidationFailed: jest.fn(),
  };

  const mockParallelExecutionService = {
    execute: jest.fn().mockResolvedValue({
      success: true,
      operations: [
        { type: 'create', path: '/src/App.tsx', content: 'parallel content' },
        { type: 'create', path: '/src/api/route.ts', content: 'api content' },
      ],
      explanation: 'Generated via parallel agents',
      conflicts: [],
      executionResult: { planId: 'plan-1', tasks: [], success: true, errors: [], duration: 100 },
      agentIds: ['frontend-agent', 'backend-agent'],
    }),
    decompose: jest.fn().mockResolvedValue({
      id: 'plan-1',
      description: 'test plan',
      tasks: [],
      estimatedComplexity: 5,
      parallelizableGroups: [],
    }),
  };

  const mockRecoveryService = {
    createCheckpoint: jest.fn().mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      label: 'Before changes',
      createdAt: Date.now(),
      status: 'pending',
      fileCount: 2,
    }),
    confirmCheckpoint: jest.fn(),
    rollback: jest.fn().mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      label: 'Before changes',
      createdAt: Date.now(),
      status: 'rolled_back',
      fileCount: 2,
    }),
    getSnapshotFileCount: jest.fn().mockReturnValue(2),
    listSnapshots: jest.fn().mockReturnValue([]),
    getStatus: jest.fn().mockReturnValue({
      recovering: false,
      lastGoodSnapshotId: null,
      snapshotCount: 0,
      rollbackCount: 0,
      lastRollbackAt: null,
    }),
  };

  const mockValidationPipeline = {
    validate: jest.fn().mockReturnValue({
      passed: true,
      issues: [],
      filesChecked: 2,
      timestamp: Date.now(),
    }),
  };

  const mockMemoryIntegrationService = {
    loadContext: jest.fn().mockResolvedValue({
      contextString: '# Project Context\n\n## ARCHITECTURE\n- REST API: Uses Express',
      entryCount: 1,
      estimatedTokens: 15,
    }),
    storeOutcome: jest.fn().mockResolvedValue(undefined),
    trackMessage: jest.fn().mockResolvedValue(undefined),
    hydrateProjectContext: jest.fn().mockResolvedValue({
      contextString: '',
      entryCount: 0,
      estimatedTokens: 0,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: ConversationsService, useValue: mockConversationsService },
        { provide: AiService, useValue: mockAiService },
        { provide: CodegenService, useValue: mockCodegenService },
        { provide: FilesService, useValue: mockFilesService },
        { provide: GitService, useValue: mockGitService },
        { provide: DeployService, useValue: mockDeployService },
        { provide: WorkflowGateway, useValue: mockGateway },
        { provide: ParallelExecutionService, useValue: mockParallelExecutionService },
        { provide: RecoveryService, useValue: mockRecoveryService },
        { provide: ValidationPipeline, useValue: mockValidationPipeline },
        { provide: MemoryIntegrationService, useValue: mockMemoryIntegrationService },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    jest.clearAllMocks();

    // Re-setup default mocks after clearAllMocks
    mockAiService.getAvailableProviders.mockReturnValue(['openai']);
    mockAiService.getProvider.mockReturnValue(mockAiProvider);
    mockAiProvider.complete.mockResolvedValue({
      content: JSON.stringify({
        intent: 'create_project',
        description: 'Create a landing page',
        parameters: {},
      }),
    });
    mockConversationsService.addMessage.mockResolvedValue({ id: 'msg-1', content: 'test' });
    mockCodegenService.generateCode.mockResolvedValue({
      success: true,
      operations: [
        { type: 'create', path: '/src/App.tsx', content: 'export default function App() {}' },
        { type: 'create', path: '/src/index.ts', content: 'import App from "./App"' },
      ],
      explanation: 'Created the main App component',
    });
    mockFilesService.getTree.mockReturnValue({ fileCount: 2, files: [] });
    mockFilesService.listDirectory.mockReturnValue([
      { path: '/src/App.tsx', name: 'App.tsx', type: 'file' },
    ]);
    mockFilesService.readFile.mockReturnValue({
      path: '/src/App.tsx',
      content: { text: 'export default function App() {}', language: 'typescriptreact' },
    });
    mockGitService.commit.mockResolvedValue({ sha: 'abc123', message: 'Initial commit' });
    mockDeployService.create.mockResolvedValue({
      id: 'deploy-1',
      status: 'DEPLOYED',
      url: 'https://my-app.vercel.app',
    });
    mockRecoveryService.createCheckpoint.mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      label: 'Before changes',
      createdAt: Date.now(),
      status: 'pending',
      fileCount: 2,
    });
    mockRecoveryService.confirmCheckpoint.mockReturnValue(undefined);
    mockRecoveryService.rollback.mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      label: 'Before changes',
      createdAt: Date.now(),
      status: 'rolled_back',
      fileCount: 2,
    });
    mockRecoveryService.getSnapshotFileCount.mockReturnValue(2);
    mockValidationPipeline.validate.mockReturnValue({
      passed: true,
      issues: [],
      filesChecked: 2,
      timestamp: Date.now(),
    });
    mockMemoryIntegrationService.loadContext.mockResolvedValue({
      contextString: '# Project Context\n\n## ARCHITECTURE\n- REST API: Uses Express',
      entryCount: 1,
      estimatedTokens: 15,
    });
    mockMemoryIntegrationService.storeOutcome.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processMessage', () => {
    const baseDto = {
      projectId: 'project-1',
      conversationId: 'conv-1',
      message: 'Build me a landing page',
    };

    it('should store the user message in the conversation', async () => {
      await service.processMessage('user-1', baseDto);

      expect(mockConversationsService.addMessage).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
        { role: 'user', content: 'Build me a landing page' },
      );
    });

    it('should route create_project intent to code generation', async () => {
      const result = await service.processMessage('user-1', baseDto);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('create_project');
      expect(result.filesChanged).toContain('/src/App.tsx');
      // create_project is complex, so it routes through parallel execution
      expect(mockParallelExecutionService.execute).toHaveBeenCalledWith(
        'project-1',
        'Create a landing page',
        expect.objectContaining({ intent: 'create_project' }),
      );
    });

    it('should emit WebSocket events during workflow', async () => {
      await service.processMessage('user-1', baseDto);

      expect(mockGateway.emitWorkflowStarted).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ status: 'started' }),
      );
      expect(mockGateway.emitWorkflowProgress).toHaveBeenCalled();
      expect(mockGateway.emitWorkflowFilesUpdated).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ files: ['/src/App.tsx', '/src/api/route.ts'] }),
      );
      expect(mockGateway.emitWorkflowCompleted).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should store assistant response after code generation', async () => {
      await service.processMessage('user-1', baseDto);

      // addMessage should be called twice: user message + assistant response
      expect(mockConversationsService.addMessage).toHaveBeenCalledTimes(2);
      expect(mockConversationsService.addMessage).toHaveBeenLastCalledWith(
        'conv-1',
        'user-1',
        expect.objectContaining({
          role: 'assistant',
          metadata: expect.objectContaining({
            intent: 'create_project',
            filesChanged: ['/src/App.tsx', '/src/api/route.ts'],
          }),
        }),
      );
    });

    it('should handle deploy intent', async () => {
      mockAiProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          intent: 'deploy',
          description: 'Deploy the project',
          parameters: {},
        }),
      });

      const result = await service.processMessage('user-1', {
        ...baseDto,
        message: 'Deploy my project',
      });

      expect(result.intent).toBe('deploy');
      expect(result.success).toBe(true);
      expect(mockDeployService.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'project-1', provider: 'VERCEL' }),
      );
    });

    it('should handle git_commit intent', async () => {
      mockAiProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          intent: 'git_commit',
          description: 'Commit changes',
          parameters: { message: 'feat: add landing page' },
        }),
      });

      // Setup: listDirectory returns root entries including a directory
      mockFilesService.listDirectory.mockImplementation((_projectId: string, path: string) => {
        if (path === '/') {
          return [
            { path: '/src', name: 'src', type: 'directory' },
            { path: '/README.md', name: 'README.md', type: 'file', content: { text: '# Hello', language: 'markdown' } },
          ];
        }
        if (path === '/src') {
          return [
            { path: '/src/App.tsx', name: 'App.tsx', type: 'file', content: { text: 'export default function App() {}', language: 'typescriptreact' } },
          ];
        }
        return [];
      });

      mockFilesService.readFile.mockImplementation((_projectId: string, filePath: string) => {
        if (filePath === '/README.md') {
          return { path: '/README.md', content: { text: '# Hello', language: 'markdown' } };
        }
        if (filePath === '/src/App.tsx') {
          return { path: '/src/App.tsx', content: { text: 'export default function App() {}', language: 'typescriptreact' } };
        }
        throw new Error('File not found');
      });

      const result = await service.processMessage('user-1', {
        ...baseDto,
        message: 'Commit my changes with message "feat: add landing page"',
      });

      expect(result.intent).toBe('git_commit');
      expect(mockGitService.commit).toHaveBeenCalled();

      // Verify that both root-level and nested files are collected
      const commitCall = mockGitService.commit.mock.calls[0];
      const committedFiles = commitCall[1].files;
      expect(committedFiles).toHaveLength(2);
      expect(committedFiles.map((f: { path: string }) => f.path)).toContain('/README.md');
      expect(committedFiles.map((f: { path: string }) => f.path)).toContain('/src/App.tsx');
    });

    it('should handle general_question intent', async () => {
      mockAiProvider.complete
        .mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'general_question',
            description: 'General question',
            parameters: {},
          }),
        })
        .mockResolvedValueOnce({
          content: 'React is a JavaScript library for building user interfaces.',
        });

      const result = await service.processMessage('user-1', {
        ...baseDto,
        message: 'What is React?',
      });

      expect(result.intent).toBe('general_question');
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully and emit error event', async () => {
      mockAiProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          intent: 'modify_code',
          description: 'Modify something',
          parameters: {},
        }),
      });
      mockCodegenService.generateCode.mockRejectedValue(
        new Error('No AI provider available for code generation'),
      );

      const result = await service.processMessage('user-1', baseDto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No AI provider available for code generation');
      expect(mockGateway.emitWorkflowError).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should pass framework option to code generation', async () => {
      // Use modify_code intent which goes through simple path (not parallel)
      mockAiProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          intent: 'modify_code',
          description: 'Modify the header',
          parameters: {},
        }),
      });

      await service.processMessage('user-1', {
        ...baseDto,
        message: 'Modify the header',
        framework: 'nextjs',
      });

      expect(mockCodegenService.generateCode).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ framework: 'nextjs' }),
      );
    });

    it('should route complex requests through parallel execution', async () => {
      mockAiProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          intent: 'create_project',
          description: 'Build a full-stack app',
          parameters: {},
        }),
      });

      const result = await service.processMessage('user-1', baseDto);

      expect(result.success).toBe(true);
      expect(mockParallelExecutionService.execute).toHaveBeenCalledWith(
        'project-1',
        'Build a full-stack app',
        expect.objectContaining({ intent: 'create_project' }),
      );
      expect(result.filesChanged).toContain('/src/App.tsx');
      expect(result.filesChanged).toContain('/src/api/route.ts');
    });
  });

  describe('analyzeIntent', () => {
    it('should classify messages using AI when available', async () => {
      mockAiProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          intent: 'add_feature',
          description: 'Add dark mode toggle',
          parameters: { component: 'ThemeToggle' },
        }),
      });

      const result = await service.analyzeIntent('Add a dark mode toggle', 'project-1');

      expect(result.intent).toBe('add_feature');
      expect(result.description).toBe('Add dark mode toggle');
    });

    it('should fall back to heuristic analysis when no AI provider is available', async () => {
      mockAiService.getAvailableProviders.mockReturnValue([]);

      const result = await service.analyzeIntent(
        'Create a new landing page',
        'project-1',
      );

      expect(result.intent).toBe('create_project');
    });

    it('should fall back to heuristic when AI call fails', async () => {
      mockAiProvider.complete.mockRejectedValue(new Error('API timeout'));

      const result = await service.analyzeIntent('Deploy my app', 'project-1');

      expect(result.intent).toBe('deploy');
    });

    it('should handle invalid JSON response from AI', async () => {
      mockAiProvider.complete.mockResolvedValue({
        content: 'This is not valid JSON',
      });

      const result = await service.analyzeIntent('Something', 'project-1');

      expect(result.intent).toBe('general_question');
    });

    it('should handle markdown-wrapped JSON', async () => {
      mockAiProvider.complete.mockResolvedValue({
        content: '```json\n{"intent": "fix_bug", "description": "Fix the login issue", "parameters": {}}\n```',
      });

      const result = await service.analyzeIntent('Fix the login bug', 'project-1');

      expect(result.intent).toBe('fix_bug');
      expect(result.description).toBe('Fix the login issue');
    });

    it('should default unknown intents to general_question', async () => {
      mockAiProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          intent: 'unknown_intent',
          description: 'test',
          parameters: {},
        }),
      });

      const result = await service.analyzeIntent('Something weird', 'project-1');

      expect(result.intent).toBe('general_question');
    });
  });

  describe('heuristic intent analysis', () => {
    beforeEach(() => {
      mockAiService.getAvailableProviders.mockReturnValue([]);
    });

    it('should detect create_project intent', async () => {
      const result = await service.analyzeIntent('Build me a todo app', 'project-1');
      expect(result.intent).toBe('create_project');
    });

    it('should detect deploy intent', async () => {
      const result = await service.analyzeIntent('Deploy this project', 'project-1');
      expect(result.intent).toBe('deploy');
    });

    it('should detect git_commit intent', async () => {
      const result = await service.analyzeIntent('Commit my changes', 'project-1');
      expect(result.intent).toBe('git_commit');
    });

    it('should detect fix_bug intent', async () => {
      const result = await service.analyzeIntent('Fix the login bug', 'project-1');
      expect(result.intent).toBe('fix_bug');
    });

    it('should detect add_feature intent', async () => {
      const result = await service.analyzeIntent('Add a search feature', 'project-1');
      expect(result.intent).toBe('add_feature');
    });

    it('should detect modify_code intent', async () => {
      const result = await service.analyzeIntent('Change the header color', 'project-1');
      expect(result.intent).toBe('modify_code');
    });

    it('should default to general_question', async () => {
      const result = await service.analyzeIntent('How does React work?', 'project-1');
      expect(result.intent).toBe('general_question');
    });
  });

  describe('graceful handling when no AI provider is configured', () => {
    it('should handle general questions without AI provider', async () => {
      mockAiService.getAvailableProviders.mockReturnValue([]);

      const result = await service.processMessage('user-1', {
        projectId: 'project-1',
        conversationId: 'conv-1',
        message: 'How does React work?',
      });

      expect(result.success).toBe(true);
      expect(result.intent).toBe('general_question');
      expect(result.message).toContain('no AI provider is currently configured');
    });

    it('should use heuristic for code gen and throw on codegen failure', async () => {
      mockAiService.getAvailableProviders.mockReturnValue([]);
      mockAiService.getProvider.mockReturnValue(undefined);
      mockParallelExecutionService.execute.mockRejectedValue(
        new Error('No AI provider available for parallel execution'),
      );
      mockCodegenService.generateCode.mockRejectedValue(
        new Error('No AI provider available for code generation'),
      );

      const result = await service.processMessage('user-1', {
        projectId: 'project-1',
        conversationId: 'conv-1',
        message: 'Create a todo app',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider available');
    });
  });
});

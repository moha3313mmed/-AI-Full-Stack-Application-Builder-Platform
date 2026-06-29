import { Injectable, Logger } from '@nestjs/common';

import { AiService } from '../ai/ai.service';
import { CodegenService } from '../codegen/codegen.service';
import { ConversationsService } from '../conversations/conversations.service';
import { DeployService } from '../deploy/deploy.service';
import { DeploymentProviderDto } from '../deploy/dto/create-deployment.dto';
import { FilesService } from '../files/files.service';
import { GitService } from '../git/git.service';
import { MemoryIntegrationService } from '../memory/memory-integration.service';

import { ProcessMessageDto } from './dto';
import { ParallelExecutionService } from './parallel-execution.service';
import { RecoveryService } from './recovery.service';
import { ValidationPipeline } from './validation-pipeline';
import { WorkflowGateway } from './workflow.gateway';

/**
 * Supported workflow intents that can be derived from user messages.
 */
export type WorkflowIntent =
  | 'create_project'
  | 'modify_code'
  | 'add_feature'
  | 'fix_bug'
  | 'deploy'
  | 'git_commit'
  | 'general_question';

export interface IntentAnalysisResult {
  intent: WorkflowIntent;
  description: string;
  parameters: Record<string, unknown>;
}

export interface WorkflowConflict {
  /** File path that was contested */
  path: string;
  /** Agent IDs that wrote to this path */
  agentIds: string[];
  /** Strategy used to resolve the conflict */
  strategy: string;
}

export interface WorkflowResult {
  workflowId: string;
  intent: WorkflowIntent;
  success: boolean;
  message: string;
  filesChanged?: string[];
  error?: string;
  /** Conflicts that were automatically resolved during parallel execution */
  conflicts?: WorkflowConflict[];
}

/**
 * WorkflowService orchestrates the end-to-end pipeline:
 * user message -> intent analysis -> code generation -> VFS -> storage -> notifications
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly aiService: AiService,
    private readonly codegenService: CodegenService,
    private readonly filesService: FilesService,
    private readonly gitService: GitService,
    private readonly deployService: DeployService,
    private readonly gateway: WorkflowGateway,
    private readonly parallelExecutionService: ParallelExecutionService,
    private readonly recoveryService: RecoveryService,
    private readonly validationPipeline: ValidationPipeline,
    private readonly memoryIntegrationService: MemoryIntegrationService,
  ) {}

  /**
   * Main orchestration method: processes a user message through the full pipeline.
   */
  async processMessage(
    userId: string,
    dto: ProcessMessageDto,
  ): Promise<WorkflowResult> {
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { projectId, conversationId, message } = dto;

    this.logger.log(`[${workflowId}] Starting workflow for project ${projectId}`);

    // Emit workflow started
    this.gateway.emitWorkflowStarted(projectId, {
      workflowId,
      projectId,
      step: 'started',
      status: 'started',
      message: 'Processing your message...',
    });

    try {
      // Step 1: Store the user message
      await this.conversationsService.addMessage(conversationId, userId, {
        role: 'user',
        content: message,
      });

      // Step 1.5: Load project memory context
      const memoryContext = await this.memoryIntegrationService.loadContext(projectId);
      this.logger.debug(
        `[${workflowId}] Loaded memory context: ${memoryContext.entryCount} entries, ~${memoryContext.estimatedTokens} tokens`,
      );

      this.gateway.emitWorkflowProgress(projectId, {
        workflowId,
        projectId,
        step: 'intent_analysis',
        status: 'in_progress',
        message: 'Analyzing your request...',
      });

      // Step 2: Analyze intent
      const intentResult = await this.analyzeIntent(message, projectId);

      this.logger.log(`[${workflowId}] Intent: ${intentResult.intent}`);

      // Step 3: Route to appropriate sub-workflow based on intent
      let result: WorkflowResult;

      switch (intentResult.intent) {
        case 'create_project':
        case 'modify_code':
        case 'add_feature':
        case 'fix_bug':
          result = await this.handleCodeGenerationWorkflow(
            workflowId,
            userId,
            projectId,
            conversationId,
            message,
            intentResult,
            dto.framework,
            memoryContext.contextString,
          );
          break;

        case 'deploy':
          result = await this.handleDeployWorkflow(
            workflowId,
            projectId,
            conversationId,
            userId,
            intentResult,
          );
          break;

        case 'git_commit':
          result = await this.handleGitCommitWorkflow(
            workflowId,
            projectId,
            conversationId,
            userId,
            intentResult,
          );
          break;

        case 'general_question':
        default:
          result = await this.handleGeneralQuestion(
            workflowId,
            projectId,
            conversationId,
            userId,
            message,
            memoryContext.contextString,
          );
          break;
      }

      // Emit workflow completed
      this.gateway.emitWorkflowCompleted(projectId, {
        workflowId,
        projectId,
        step: 'completed',
        status: 'completed',
        message: result.message,
        data: { filesChanged: result.filesChanged },
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[${workflowId}] Workflow failed: ${errorMessage}`);

      // Store error response in conversation
      await this.safeAddMessage(conversationId, userId, {
        role: 'assistant',
        content: `I encountered an error processing your request: ${errorMessage}`,
        metadata: { workflowId, error: true },
      });

      // Emit workflow error
      this.gateway.emitWorkflowError(projectId, {
        workflowId,
        projectId,
        step: 'error',
        status: 'failed',
        message: errorMessage,
      });

      return {
        workflowId,
        intent: 'general_question',
        success: false,
        message: errorMessage,
        error: errorMessage,
      };
    }
  }

  /**
   * Analyze the user message to determine intent.
   * Falls back to 'general_question' if no AI provider is available.
   */
  async analyzeIntent(
    message: string,
    _projectId: string,
  ): Promise<IntentAnalysisResult> {
    const availableProviders = this.aiService.getAvailableProviders();

    if (availableProviders.length === 0) {
      // No AI provider configured - use heuristic-based intent detection
      return this.heuristicIntentAnalysis(message);
    }

    const provider = this.aiService.getProvider(availableProviders[0]);
    if (!provider) {
      return this.heuristicIntentAnalysis(message);
    }

    try {
      const response = await provider.complete({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for a code generation platform. Analyze the user message and classify it into one of these intents:
- "create_project": The user wants to create a new project or application from scratch
- "modify_code": The user wants to modify existing code
- "add_feature": The user wants to add a new feature to an existing project
- "fix_bug": The user wants to fix a bug or issue
- "deploy": The user wants to deploy the project
- "git_commit": The user wants to commit changes to git
- "general_question": The user is asking a general question or having a conversation

Respond with ONLY a JSON object in this format:
{"intent": "<intent>", "description": "<brief description of what user wants>", "parameters": {"key": "value"}}

Do not include any other text, markdown, or explanation.`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.1,
        maxTokens: 200,
      });

      return this.parseIntentResponse(response.content);
    } catch (error) {
      this.logger.warn(`AI intent analysis failed, using heuristic: ${error}`);
      return this.heuristicIntentAnalysis(message);
    }
  }

  // ==========================================================================
  // Sub-Workflows
  // ==========================================================================

  private async handleCodeGenerationWorkflow(
    workflowId: string,
    userId: string,
    projectId: string,
    conversationId: string,
    message: string,
    intentResult: IntentAnalysisResult,
    framework?: string,
    _memoryContext?: string,
  ): Promise<WorkflowResult> {
    this.gateway.emitWorkflowProgress(projectId, {
      workflowId,
      projectId,
      step: 'code_generation',
      status: 'in_progress',
      message: 'Generating code...',
    });

    // Create a checkpoint before code generation
    const checkpoint = await this.recoveryService.createCheckpoint(
      projectId,
      `Before: ${intentResult.description || message}`,
    );

    // Determine if the request is complex enough for parallel execution
    const isComplex = this.isComplexRequest(intentResult, message);

    // Attempt generation (with one retry on validation failure)
    const maxAttempts = 2;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const retryContext = attempt > 1 && lastError
        ? `\n\nPrevious attempt failed validation with: ${lastError}. Please fix these issues.`
        : '';
      const effectiveMessage = (intentResult.description || message) + retryContext;

      if (attempt > 1) {
        this.gateway.emitRetryStarted(projectId, {
          attempt,
          strategy: 'error_context_injection',
        });
      }

      try {
        let filesChanged: string[];
        let summary: string;
        let success: boolean;
        let resolvedConflicts: WorkflowConflict[] | undefined;

        if (isComplex) {
          const result = await this.executeParallelGeneration(
            workflowId,
            projectId,
            effectiveMessage,
            intentResult,
          );
          filesChanged = result.filesChanged;
          summary = result.summary;
          success = result.success;
          resolvedConflicts = result.conflicts;
        } else {
          const result = await this.executeSimpleGeneration(
            projectId,
            effectiveMessage,
            framework,
          );
          filesChanged = result.filesChanged;
          summary = result.summary;
          success = result.success;
        }

        // Run validation on the generated files
        if (filesChanged.length > 0) {
          const validationResult = this.validationPipeline.validate(projectId, filesChanged);

          if (!validationResult.passed) {
            const errorMessages = validationResult.issues
              .filter((i) => i.severity === 'error')
              .map((i) => `${i.path}: ${i.message}`);

            this.gateway.emitValidationFailed(projectId, {
              errors: errorMessages,
              willRollback: true,
            });

            lastError = errorMessages.join('; ');

            // Rollback to checkpoint
            this.gateway.emitRollbackStarted(projectId, {
              reason: `Validation failed: ${errorMessages.length} error(s)`,
              snapshotId: checkpoint.id,
            });

            await this.recoveryService.rollback(projectId, checkpoint.id);

            const filesRestored = this.recoveryService.getSnapshotFileCount(
              projectId,
              checkpoint.id,
            );
            this.gateway.emitRollbackCompleted(projectId, {
              restoredSnapshotId: checkpoint.id,
              filesRestored,
            });

            // If this was the last attempt, return failure
            if (attempt === maxAttempts) {
              const failureSummary =
                `Code generation failed validation after ${maxAttempts} attempts. ` +
                `Rolled back to previous state. Issues: ${lastError}`;

              await this.safeAddMessage(conversationId, userId, {
                role: 'assistant',
                content: failureSummary,
                metadata: {
                  workflowId,
                  intent: intentResult.intent,
                  validationFailed: true,
                  rolledBack: true,
                  errors: errorMessages,
                },
              });

              return {
                workflowId,
                intent: intentResult.intent,
                success: false,
                message: failureSummary,
                error: lastError,
              };
            }

            // Continue to next attempt
            continue;
          }
        }

        // Validation passed - confirm the checkpoint
        this.recoveryService.confirmCheckpoint(projectId, checkpoint.id);

        // Store generation outcome in project memory
        this.memoryIntegrationService.storeOutcome(projectId, {
          description: intentResult.description || message,
          filesChanged,
          codeSnippets: {},
          intent: intentResult.intent,
        }).catch((err) => {
          this.logger.warn(`Memory outcome storage failed (non-blocking): ${err}`);
        });

        // Emit files updated event
        if (filesChanged.length > 0) {
          this.gateway.emitWorkflowFilesUpdated(projectId, {
            workflowId,
            files: filesChanged,
          });
        }

        // Store assistant response in conversation
        await this.safeAddMessage(conversationId, userId, {
          role: 'assistant',
          content: summary,
          metadata: {
            workflowId,
            intent: intentResult.intent,
            filesChanged,
            success,
            ...(attempt > 1 ? { retriedAttempt: attempt } : {}),
          },
        });

        return {
          workflowId,
          intent: intentResult.intent,
          success,
          message: summary,
          filesChanged,
          conflicts: resolvedConflicts,
        };
      } catch (error) {
        // Unexpected error during generation
        if (attempt === maxAttempts) {
          // Rollback on unexpected error
          try {
            this.gateway.emitRollbackStarted(projectId, {
              reason: `Generation error: ${error instanceof Error ? error.message : 'Unknown'}`,
              snapshotId: checkpoint.id,
            });

            await this.recoveryService.rollback(projectId, checkpoint.id);

            const filesRestored = this.recoveryService.getSnapshotFileCount(
              projectId,
              checkpoint.id,
            );
            this.gateway.emitRollbackCompleted(projectId, {
              restoredSnapshotId: checkpoint.id,
              filesRestored,
            });
          } catch (rollbackErr) {
            this.logger.error(`Rollback failed: ${rollbackErr}`);
          }
          throw error;
        }
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Should not reach here but handle gracefully
    return {
      workflowId,
      intent: intentResult.intent,
      success: false,
      message: 'Code generation failed unexpectedly',
      error: lastError,
    };
  }

  /**
   * Execute simple code generation via CodegenService.
   */
  private async executeSimpleGeneration(
    projectId: string,
    message: string,
    framework?: string,
  ): Promise<{ filesChanged: string[]; summary: string; success: boolean }> {
    const codegenResult = await this.codegenService.generateCode(projectId, {
      description: message,
      framework: framework as 'nextjs' | 'react' | 'express' | 'nestjs' | undefined,
    });

    const filesChanged = codegenResult.operations.map((op) => op.path);
    const summary = this.buildChangesSummary(codegenResult.operations, codegenResult.explanation);

    return { filesChanged, summary, success: codegenResult.success };
  }

  /**
   * Execute parallel multi-agent code generation.
   */
  private async executeParallelGeneration(
    workflowId: string,
    projectId: string,
    message: string,
    intentResult: IntentAnalysisResult,
  ): Promise<{ filesChanged: string[]; summary: string; success: boolean; conflicts: WorkflowConflict[] }> {
    this.gateway.emitWorkflowProgress(projectId, {
      workflowId,
      projectId,
      step: 'parallel_execution',
      status: 'in_progress',
      message: 'Executing multi-agent parallel pipeline...',
    });

    const result = await this.parallelExecutionService.execute(
      projectId,
      message,
      { intent: intentResult.intent, parameters: intentResult.parameters },
    );

    const filesChanged = result.operations.map((op) => op.path);

    // Map conflict details for user visibility
    const conflicts: WorkflowConflict[] = result.conflicts.map((c) => ({
      path: c.path,
      agentIds: c.agentIds,
      strategy: c.strategy,
    }));

    const conflictNote = conflicts.length > 0
      ? `\n\nNote: ${conflicts.length} file conflict(s) were automatically resolved (${conflicts.map((c) => c.path).join(', ')}).`
      : '';

    const summary = result.explanation
      ? `${result.explanation}${conflictNote}`
      : `Generated ${filesChanged.length} file(s) via parallel agents.${conflictNote}`;

    return { filesChanged, summary, success: result.success, conflicts };
  }

  /**
   * Determine if a request is complex enough to warrant parallel multi-agent execution.
   * Complex requests involve multiple files, architectural scope, or new project creation.
   */
  isComplexRequest(intentResult: IntentAnalysisResult, message: string): boolean {
    // Create project is always complex - involves multiple agents
    if (intentResult.intent === 'create_project') {
      return true;
    }

    // Add feature with architectural scope
    if (intentResult.intent === 'add_feature') {
      const lower = message.toLowerCase();
      const architecturalKeywords = [
        'authentication', 'database', 'api', 'full-stack', 'fullstack',
        'backend and frontend', 'multiple', 'system', 'architecture',
        'microservice', 'real-time', 'realtime',
      ];
      if (architecturalKeywords.some((kw) => lower.includes(kw))) {
        return true;
      }
    }

    // Check parameters for multi-file indication
    const params = intentResult.parameters;
    if (params && typeof params.fileCount === 'number' && params.fileCount > 2) {
      return true;
    }

    return false;
  }

  private async handleDeployWorkflow(
    workflowId: string,
    projectId: string,
    conversationId: string,
    userId: string,
    intentResult: IntentAnalysisResult,
  ): Promise<WorkflowResult> {
    this.gateway.emitWorkflowProgress(projectId, {
      workflowId,
      projectId,
      step: 'deploy',
      status: 'in_progress',
      message: 'Preparing deployment...',
    });

    try {
      const deployment = await this.deployService.create({
        projectId,
        provider: DeploymentProviderDto.VERCEL,
        environment: 'production',
      });

      const summary = `Deployment initiated successfully. Status: ${deployment.status}${deployment.url ? `. URL: ${deployment.url}` : ''}`;

      await this.safeAddMessage(conversationId, userId, {
        role: 'assistant',
        content: summary,
        metadata: { workflowId, intent: intentResult.intent, deploymentId: deployment.id },
      });

      return {
        workflowId,
        intent: 'deploy',
        success: true,
        message: summary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
      const summary = `Deployment could not be completed: ${errorMessage}`;

      await this.safeAddMessage(conversationId, userId, {
        role: 'assistant',
        content: summary,
        metadata: { workflowId, intent: intentResult.intent, error: true },
      });

      return {
        workflowId,
        intent: 'deploy',
        success: false,
        message: summary,
        error: errorMessage,
      };
    }
  }

  private async handleGitCommitWorkflow(
    workflowId: string,
    projectId: string,
    conversationId: string,
    userId: string,
    intentResult: IntentAnalysisResult,
  ): Promise<WorkflowResult> {
    this.gateway.emitWorkflowProgress(projectId, {
      workflowId,
      projectId,
      step: 'git_commit',
      status: 'in_progress',
      message: 'Committing changes...',
    });

    try {
      // Get all files from the project VFS for commit
      const _tree = this.filesService.getTree(projectId);
      const fileList = this.filesService.listDirectory(projectId, '/');

      const files = this.collectFilesForCommit(projectId, fileList);

      const commitMessage =
        (intentResult.parameters?.message as string) ||
        `Update project files (${files.length} files)`;

      const commit = await this.gitService.commit(projectId, {
        message: commitMessage,
        branch: 'main',
        files: files.map((f) => ({
          path: f.path,
          content: f.content,
          operation: 'add' as const,
        })),
      });

      const summary = `Changes committed successfully. Commit: ${commit.sha} - "${commitMessage}"`;

      await this.safeAddMessage(conversationId, userId, {
        role: 'assistant',
        content: summary,
        metadata: { workflowId, intent: intentResult.intent, commitSha: commit.sha },
      });

      return {
        workflowId,
        intent: 'git_commit',
        success: true,
        message: summary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Git commit failed';
      const summary = `Git commit could not be completed: ${errorMessage}`;

      await this.safeAddMessage(conversationId, userId, {
        role: 'assistant',
        content: summary,
        metadata: { workflowId, intent: intentResult.intent, error: true },
      });

      return {
        workflowId,
        intent: 'git_commit',
        success: false,
        message: summary,
        error: errorMessage,
      };
    }
  }

  private async handleGeneralQuestion(
    workflowId: string,
    projectId: string,
    conversationId: string,
    userId: string,
    message: string,
    memoryContext?: string,
  ): Promise<WorkflowResult> {
    this.gateway.emitWorkflowProgress(projectId, {
      workflowId,
      projectId,
      step: 'general_response',
      status: 'in_progress',
      message: 'Generating response...',
    });

    const availableProviders = this.aiService.getAvailableProviders();

    let responseContent: string;

    if (availableProviders.length === 0) {
      responseContent =
        'I understand your question, but no AI provider is currently configured. ' +
        'Please configure an AI provider (OpenAI, Anthropic, or Gemini) to enable intelligent responses. ' +
        'You can still use the code generation features by providing specific instructions.';
    } else {
      const provider = this.aiService.getProvider(availableProviders[0]);
      if (!provider) {
        responseContent = 'AI provider is not available at the moment. Please try again later.';
      } else {
        try {
          const systemPromptParts = [
            'You are a helpful software development assistant. Provide concise, actionable answers about coding, architecture, and development practices.',
          ];
          if (memoryContext && memoryContext !== 'No project context available.') {
            systemPromptParts.push(
              `\n\nHere is the project context you should be aware of:\n${memoryContext}`,
            );
          }

          const response = await provider.complete({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: systemPromptParts.join(''),
              },
              { role: 'user', content: message },
            ],
            temperature: 0.7,
            maxTokens: 1000,
          });
          responseContent = response.content;
        } catch {
          responseContent =
            'I was unable to generate a response at this time. Please try again or rephrase your question.';
        }
      }
    }

    await this.safeAddMessage(conversationId, userId, {
      role: 'assistant',
      content: responseContent,
      metadata: { workflowId, intent: 'general_question' },
    });

    return {
      workflowId,
      intent: 'general_question',
      success: true,
      message: responseContent,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Parse the AI intent response. Handles both raw JSON and markdown-wrapped JSON.
   */
  private parseIntentResponse(content: string): IntentAnalysisResult {
    let jsonStr = content.trim();

    // Strip markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      const lines = jsonStr.split('\n');
      // Remove first line (```json or ```) and last line (```)
      lines.shift();
      if (lines[lines.length - 1]?.trim() === '```') {
        lines.pop();
      }
      jsonStr = lines.join('\n').trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validIntents: WorkflowIntent[] = [
        'create_project',
        'modify_code',
        'add_feature',
        'fix_bug',
        'deploy',
        'git_commit',
        'general_question',
      ];

      const intent = validIntents.includes(parsed.intent)
        ? parsed.intent
        : 'general_question';

      return {
        intent,
        description: parsed.description || '',
        parameters: parsed.parameters || {},
      };
    } catch {
      return {
        intent: 'general_question',
        description: content,
        parameters: {},
      };
    }
  }

  /**
   * Heuristic-based intent detection when no AI provider is available.
   */
  private heuristicIntentAnalysis(message: string): IntentAnalysisResult {
    const lower = message.toLowerCase();

    if (
      lower.includes('create') ||
      lower.includes('build') ||
      lower.includes('generate') ||
      lower.includes('scaffold') ||
      lower.includes('new project') ||
      lower.includes('start a')
    ) {
      return {
        intent: 'create_project',
        description: message,
        parameters: {},
      };
    }

    if (
      lower.includes('deploy') ||
      lower.includes('publish') ||
      lower.includes('ship')
    ) {
      return { intent: 'deploy', description: message, parameters: {} };
    }

    if (
      lower.includes('commit') ||
      lower.includes('push') ||
      lower.includes('save to git')
    ) {
      return { intent: 'git_commit', description: message, parameters: {} };
    }

    if (lower.includes('fix') || lower.includes('bug') || lower.includes('error')) {
      return { intent: 'fix_bug', description: message, parameters: {} };
    }

    if (
      lower.includes('add') ||
      lower.includes('feature') ||
      lower.includes('implement') ||
      lower.includes('include')
    ) {
      return { intent: 'add_feature', description: message, parameters: {} };
    }

    if (
      lower.includes('modify') ||
      lower.includes('change') ||
      lower.includes('update') ||
      lower.includes('refactor') ||
      lower.includes('edit')
    ) {
      return { intent: 'modify_code', description: message, parameters: {} };
    }

    return { intent: 'general_question', description: message, parameters: {} };
  }

  /**
   * Build a human-readable summary of code changes.
   */
  private buildChangesSummary(
    operations: Array<{ type: string; path: string }>,
    explanation?: string,
  ): string {
    if (operations.length === 0) {
      return explanation || 'No code changes were generated.';
    }

    const created = operations.filter((op) => op.type === 'create');
    const updated = operations.filter((op) => op.type === 'update');
    const deleted = operations.filter((op) => op.type === 'delete');

    const parts: string[] = [];

    if (explanation) {
      parts.push(explanation);
      parts.push('');
    }

    if (created.length > 0) {
      parts.push(`Created ${created.length} file(s): ${created.map((f) => f.path).join(', ')}`);
    }
    if (updated.length > 0) {
      parts.push(`Updated ${updated.length} file(s): ${updated.map((f) => f.path).join(', ')}`);
    }
    if (deleted.length > 0) {
      parts.push(`Deleted ${deleted.length} file(s): ${deleted.map((f) => f.path).join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Collect all files from VFS recursively for git commit.
   */
  private collectFilesForCommit(
    projectId: string,
    nodes: Array<{ path: string; type?: string; name: string }>,
  ): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    const collectRecursive = (entries: Array<{ path: string; type?: string; name: string }>) => {
      for (const node of entries) {
        if (node.type === 'directory') {
          // Recurse into subdirectories
          try {
            const children = this.filesService.listDirectory(projectId, node.path);
            collectRecursive(children);
          } catch {
            // Skip directories that cannot be listed
          }
        } else {
          try {
            const fileNode = this.filesService.readFile(projectId, node.path);
            if (fileNode.content) {
              files.push({ path: fileNode.path, content: fileNode.content.text });
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    };

    collectRecursive(nodes);
    return files;
  }

  /**
   * Safely add a message to a conversation, logging errors instead of throwing.
   */
  private async safeAddMessage(
    conversationId: string,
    userId: string,
    dto: { role: string; content: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    try {
      await this.conversationsService.addMessage(conversationId, userId, dto);
    } catch (error) {
      this.logger.error(
        `Failed to store message in conversation ${conversationId}: ${error}`,
      );
    }
  }
}

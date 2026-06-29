import { CodeGenerator } from '@builder/codegen';
import type { CodeGenResult, FileContext } from '@builder/codegen';
import { Injectable, Logger } from '@nestjs/common';

import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';

import { GenerateCodeDto } from './dto/generate-code.dto';
import { ModifyCodeDto } from './dto/modify-code.dto';

export interface CodegenHistoryEntry {
  id: string;
  projectId: string;
  description: string;
  timestamp: number;
  success: boolean;
  filesAffected: string[];
}

/** Maximum number of history entries to retain per project. */
const MAX_HISTORY_PER_PROJECT = 100;

@Injectable()
export class CodegenService {
  private readonly logger = new Logger(CodegenService.name);
  private readonly codeGenerator = new CodeGenerator();
  private readonly history = new Map<string, CodegenHistoryEntry[]>();

  constructor(
    private readonly aiService: AiService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Generate new code and apply it to the project VFS.
   */
  async generateCode(projectId: string, dto: GenerateCodeDto): Promise<CodeGenResult> {
    this.logger.log(`Generating code for project ${projectId}: ${dto.description}`);

    const provider = this.getProvider();
    const result = await this.codeGenerator.generateCode(
      {
        description: dto.description,
        framework: dto.framework as 'nextjs' | 'react' | 'express' | 'nestjs' | undefined,
        filesContext: this.getFileContexts(projectId, dto.targetFiles),
      },
      provider,
    );

    if (result.success) {
      this.applyOperations(projectId, result);
    }

    this.recordHistory(projectId, dto.description, result);
    return result;
  }

  /**
   * Modify existing code and apply changes to the project VFS.
   */
  async modifyCode(projectId: string, dto: ModifyCodeDto): Promise<CodeGenResult> {
    this.logger.log(`Modifying code for project ${projectId}: ${dto.description}`);

    const provider = this.getProvider();
    const existingCode = this.getFileContexts(projectId, [dto.filePath]);

    const result = await this.codeGenerator.modifyCode(
      {
        description: `${dto.description}. Instruction: ${dto.instruction}`,
        filesContext: existingCode,
      },
      existingCode,
      provider,
    );

    if (result.success) {
      this.applyOperations(projectId, result);
    }

    this.recordHistory(projectId, dto.description, result);
    return result;
  }

  /**
   * Get the code generation history for a project.
   */
  getHistory(projectId: string): CodegenHistoryEntry[] {
    return this.history.get(projectId) || [];
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getProvider() {
    const availableProviders = this.aiService.getAvailableProviders();
    if (availableProviders.length === 0) {
      throw new Error('No AI provider available for code generation');
    }
    const provider = this.aiService.getProvider(availableProviders[0]);
    if (!provider) {
      throw new Error('Failed to get AI provider instance');
    }
    return provider;
  }

  private getFileContexts(projectId: string, filePaths?: string[]): FileContext[] {
    if (!filePaths || filePaths.length === 0) {
      return [];
    }

    const contexts: FileContext[] = [];
    for (const path of filePaths) {
      try {
        const node = this.filesService.readFile(projectId, path);
        if (node.content) {
          contexts.push({
            path: node.path,
            content: node.content.text,
            language: node.content.language,
          });
        }
      } catch {
        // File may not exist yet, skip it
        this.logger.debug(`File not found for context: ${path}`);
      }
    }
    return contexts;
  }

  private applyOperations(projectId: string, result: CodeGenResult): void {
    for (const op of result.operations) {
      try {
        switch (op.type) {
          case 'create':
            if (op.content !== undefined) {
              this.filesService.createFile(projectId, op.path, op.content, op.language);
            }
            break;
          case 'update':
            if (op.content !== undefined) {
              this.filesService.updateFile(projectId, op.path, op.content, op.language);
            }
            break;
          case 'delete':
            this.filesService.deleteFile(projectId, op.path);
            break;
          case 'move':
            if (op.destination) {
              this.filesService.moveFile(projectId, op.path, op.destination);
            }
            break;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to apply operation ${op.type} on ${op.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private recordHistory(projectId: string, description: string, result: CodeGenResult): void {
    const entry: CodegenHistoryEntry = {
      id: `cg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      description,
      timestamp: Date.now(),
      success: result.success,
      filesAffected: result.operations.map((op) => op.path),
    };

    const projectHistory = this.history.get(projectId) || [];
    projectHistory.push(entry);

    // Evict oldest entries when exceeding the cap
    if (projectHistory.length > MAX_HISTORY_PER_PROJECT) {
      projectHistory.splice(0, projectHistory.length - MAX_HISTORY_PER_PROJECT);
    }

    this.history.set(projectId, projectHistory);
  }
}

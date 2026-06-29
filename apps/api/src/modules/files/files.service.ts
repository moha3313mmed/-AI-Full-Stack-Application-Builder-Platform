import {
  TemplateEngine,
  VirtualFileSystem,
} from '@builder/codegen';
import type {
  Framework,
  Language,
  VFSNode,
  ProjectFileTree,
} from '@builder/codegen';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { FilePersistenceService } from './file-persistence.service';
import { FilesGateway } from './files.gateway';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly projectFileSystems = new Map<string, VirtualFileSystem>();
  private readonly hydrationPromises = new Map<string, Promise<void>>();
  private readonly templateEngine = new TemplateEngine();

  constructor(
    private readonly gateway: FilesGateway,
    private readonly filePersistence: FilePersistenceService,
  ) {}

  /**
   * Get or create a VFS instance for a project.
   * Starts hydration from persistent storage if needed.
   */
  getProjectFS(projectId: string): VirtualFileSystem {
    let vfs = this.projectFileSystems.get(projectId);
    if (!vfs) {
      vfs = new VirtualFileSystem(projectId);
      this.projectFileSystems.set(projectId, vfs);
      this.logger.log(`Created new VFS for project: ${projectId}`);

      // Start hydration and store the promise so concurrent callers can await it
      const hydrationPromise = this.hydrateFromStorage(projectId, vfs)
        .catch((err) => {
          this.logger.error(`Failed to hydrate VFS for project ${projectId}`, err);
        })
        .finally(() => {
          this.hydrationPromises.delete(projectId);
        });
      this.hydrationPromises.set(projectId, hydrationPromise);
    }
    return vfs;
  }

  /**
   * Wait for VFS hydration to complete for a given project.
   * Returns immediately if no hydration is in progress.
   */
  async waitForHydration(projectId: string): Promise<void> {
    const promise = this.hydrationPromises.get(projectId);
    if (promise) {
      await promise;
    }
  }

  /**
   * Load project files from persistent storage and populate the VFS.
   * This is useful when the server restarts or a project needs to be loaded fresh.
   */
  async loadProject(projectId: string): Promise<VirtualFileSystem> {
    // If there's already a hydration in progress, wait for it
    const existingPromise = this.hydrationPromises.get(projectId);
    if (existingPromise) {
      await existingPromise;
      const existing = this.projectFileSystems.get(projectId);
      if (existing) {
        return existing;
      }
    }

    const vfs = new VirtualFileSystem(projectId);
    this.projectFileSystems.set(projectId, vfs);

    const hydrationPromise = this.hydrateFromStorage(projectId, vfs).finally(() => {
      this.hydrationPromises.delete(projectId);
    });
    this.hydrationPromises.set(projectId, hydrationPromise);
    await hydrationPromise;

    return vfs;
  }

  private async hydrateFromStorage(
    projectId: string,
    vfs: VirtualFileSystem,
  ): Promise<void> {
    if (!this.filePersistence.available) {
      return;
    }

    // Only hydrate if VFS is empty (just root directory)
    const tree = vfs.getTree();
    if (tree.fileCount > 0) {
      return;
    }

    const hasFiles = await this.filePersistence.hasPersistedFiles(projectId);
    if (!hasFiles) {
      return;
    }

    const files = await this.filePersistence.loadProjectFiles(projectId);
    for (const file of files) {
      try {
        if (!vfs.exists(file.path)) {
          vfs.createFile(file.path, file.content, file.language);
        }
      } catch (err) {
        this.logger.warn(
          `Failed to restore file ${file.path} for project ${projectId}: ${err}`,
        );
      }
    }

    this.logger.log(
      `Hydrated VFS for project ${projectId} with ${files.length} files from storage`,
    );
  }

  /**
   * Create a new file in the project VFS.
   */
  createFile(projectId: string, path: string, content: string, language?: string): VFSNode {
    const vfs = this.getProjectFS(projectId);
    const node = vfs.createFile(path, content, language);
    this.gateway.emitFileCreated(projectId, { path: node.path, name: node.name });

    // Persist to storage asynchronously (fire-and-forget)
    this.filePersistence
      .persistFile(projectId, node.path, content, node.content?.language)
      .catch((err) => {
        this.logger.error(`Failed to persist file ${path} for project ${projectId}`, err);
      });

    return node;
  }

  /**
   * Read a file from the project VFS.
   */
  readFile(projectId: string, path: string): VFSNode {
    const vfs = this.getProjectFS(projectId);
    try {
      return vfs.readFile(path);
    } catch {
      throw new NotFoundException(`File not found: ${path}`);
    }
  }

  /**
   * Update an existing file in the project VFS.
   */
  updateFile(projectId: string, path: string, content: string, language?: string): VFSNode {
    const vfs = this.getProjectFS(projectId);
    try {
      const node = vfs.updateFile(path, content, language);
      this.gateway.emitFileUpdated(projectId, { path: node.path, name: node.name });

      // Persist to storage asynchronously (fire-and-forget)
      this.filePersistence
        .persistFile(projectId, node.path, content, node.content?.language)
        .catch((err) => {
          this.logger.error(`Failed to persist updated file ${path} for project ${projectId}`, err);
        });

      return node;
    } catch {
      throw new NotFoundException(`File not found: ${path}`);
    }
  }

  /**
   * Delete a file from the project VFS.
   */
  deleteFile(projectId: string, path: string): void {
    const vfs = this.getProjectFS(projectId);
    try {
      vfs.deleteFile(path);
      this.gateway.emitFileDeleted(projectId, { path });

      // Remove from persistent storage asynchronously (fire-and-forget)
      this.filePersistence
        .deletePersistedFile(projectId, path)
        .catch((err) => {
          this.logger.error(`Failed to delete persisted file ${path} for project ${projectId}`, err);
        });
    } catch {
      throw new NotFoundException(`File not found: ${path}`);
    }
  }

  /**
   * Move a file within the project VFS.
   */
  moveFile(projectId: string, from: string, to: string): VFSNode {
    const vfs = this.getProjectFS(projectId);
    const node = vfs.moveNode(from, to);
    this.gateway.emitFileMoved(projectId, { from, to, path: node.path });
    return node;
  }

  /**
   * List the contents of a directory in the project VFS.
   */
  listDirectory(projectId: string, path: string): VFSNode[] {
    const vfs = this.getProjectFS(projectId);
    return vfs.listDirectory(path);
  }

  /**
   * Get the file tree metadata for a project.
   */
  getTree(projectId: string): ProjectFileTree {
    const vfs = this.getProjectFS(projectId);
    return vfs.getTree();
  }

  /**
   * Get the nested file tree structure for a project (for UI rendering).
   */
  getFileTree(projectId: string) {
    const vfs = this.getProjectFS(projectId);
    return vfs.getFileTree();
  }

  /**
   * Scaffold a project using a framework template.
   */
  scaffoldProject(
    projectId: string,
    framework: string,
    options?: { name?: string; language?: string },
  ): ProjectFileTree {
    const vfs = this.getProjectFS(projectId);
    const name = options?.name || projectId;
    const language = (options?.language || 'typescript') as Language;

    const operations = this.templateEngine.scaffoldProject({
      framework: framework as Framework,
      name,
      language,
    });

    for (const op of operations) {
      if (op.type === 'create' && op.content !== undefined) {
        vfs.createFile(op.path, op.content, op.language);
      }
    }

    this.logger.log(
      `Scaffolded ${framework} project for ${projectId} with ${operations.length} files`,
    );

    return vfs.getTree();
  }
}

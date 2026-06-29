import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { StorageService } from './storage.service';

export interface PersistedFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

@Injectable()
export class FilePersistenceService {
  private readonly logger = new Logger(FilePersistenceService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Whether persistent storage is available.
   * When false, operations will be skipped gracefully.
   */
  get available(): boolean {
    return this.storageService.available;
  }

  /**
   * Persist a file to S3 and upsert its metadata in the database.
   */
  async persistFile(
    projectId: string,
    path: string,
    content: string,
    language?: string,
  ): Promise<void> {
    if (!this.storageService.available) {
      return;
    }

    try {
      const s3Key = await this.storageService.uploadFile(projectId, path, content);
      const hash = createHash('sha256').update(content).digest('hex');
      const size = Buffer.byteLength(content, 'utf-8');

      await this.prisma.projectFile.upsert({
        where: {
          projectId_path: { projectId, path },
        },
        create: {
          projectId,
          path,
          language: language || 'plaintext',
          size,
          hash,
          s3Key,
        },
        update: {
          language: language || undefined,
          size,
          hash,
          s3Key,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist file ${path} for project ${projectId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Delete a persisted file from S3 and remove its database record.
   */
  async deletePersistedFile(projectId: string, path: string): Promise<void> {
    if (!this.storageService.available) {
      return;
    }

    try {
      const record = await this.prisma.projectFile.findUnique({
        where: {
          projectId_path: { projectId, path },
        },
      });

      if (record) {
        await this.storageService.deleteFile(record.s3Key);
        await this.prisma.projectFile.delete({
          where: { id: record.id },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete persisted file ${path} for project ${projectId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Load all persisted files for a project from S3.
   * Returns file metadata and content for VFS hydration.
   */
  async loadProjectFiles(projectId: string): Promise<PersistedFile[]> {
    if (!this.storageService.available) {
      return [];
    }

    try {
      const records = await this.prisma.projectFile.findMany({
        where: { projectId },
        orderBy: { path: 'asc' },
      });

      const files: PersistedFile[] = [];

      for (const record of records) {
        try {
          const content = await this.storageService.downloadFile(record.s3Key);
          files.push({
            path: record.path,
            content,
            language: record.language,
            size: record.size,
          });
        } catch (downloadError) {
          this.logger.error(
            `Failed to download file ${record.path} (key: ${record.s3Key}) for project ${projectId}`,
            downloadError instanceof Error ? downloadError.stack : downloadError,
          );
        }
      }

      return files;
    } catch (error) {
      this.logger.error(
        `Failed to load project files for ${projectId}`,
        error instanceof Error ? error.stack : error,
      );
      return [];
    }
  }

  /**
   * Check if a project has any persisted files in the database.
   */
  async hasPersistedFiles(projectId: string): Promise<boolean> {
    if (!this.storageService.available) {
      return false;
    }

    try {
      const count = await this.prisma.projectFile.count({
        where: { projectId },
      });
      return count > 0;
    } catch (error) {
      this.logger.error(
        `Failed to check persisted files for ${projectId}`,
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }
}

import { SnapshotManager, type VFSSnapshot } from '@builder/codegen';
import { Injectable, Logger } from '@nestjs/common';

import { FilePersistenceService } from '../files/file-persistence.service';
import { FilesService } from '../files/files.service';

/**
 * Status of a snapshot checkpoint.
 */
export type SnapshotStatus = 'pending' | 'confirmed' | 'rolled_back';

/**
 * Extended snapshot info including status and project association.
 */
export interface SnapshotRecord {
  /** Snapshot ID */
  id: string;
  /** Project this snapshot belongs to */
  projectId: string;
  /** Human-readable label */
  label?: string;
  /** When the snapshot was created */
  createdAt: number;
  /** Current status of the snapshot */
  status: SnapshotStatus;
  /** Number of files at snapshot time */
  fileCount: number;
}

/**
 * Recovery state for a project.
 */
export interface RecoveryState {
  /** Whether a recovery is currently in progress */
  recovering: boolean;
  /** The last successful snapshot ID */
  lastGoodSnapshotId: string | null;
  /** Total number of snapshots */
  snapshotCount: number;
  /** Number of rollbacks performed */
  rollbackCount: number;
  /** Last rollback timestamp */
  lastRollbackAt: number | null;
}

/**
 * Maximum number of snapshots to retain per project.
 */
const MAX_SNAPSHOTS_PER_PROJECT = 10;

/**
 * RecoveryService manages VFS snapshots for automatic and manual rollback.
 *
 * It provides:
 * - Automatic checkpoint creation before code generation
 * - Snapshot persistence to S3 for cross-restart durability
 * - History management (keeps last 10 per project)
 * - Rollback to any previous snapshot
 * - Recovery state tracking
 */
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);
  private readonly snapshotManagers = new Map<string, SnapshotManager>();
  private readonly snapshotRecords = new Map<string, SnapshotRecord[]>();
  private readonly recoveryStates = new Map<string, RecoveryState>();

  constructor(
    private readonly filesService: FilesService,
    private readonly filePersistence: FilePersistenceService,
  ) {}

  /**
   * Create a checkpoint (snapshot) of the current VFS state before code generation.
   * Persists snapshot metadata to S3 if available.
   */
  async createCheckpoint(projectId: string, label?: string): Promise<SnapshotRecord> {
    const vfs = this.filesService.getProjectFS(projectId);
    const manager = this.getSnapshotManager(projectId);

    const snapshot = manager.createSnapshot(vfs, label);

    const record: SnapshotRecord = {
      id: snapshot.id,
      projectId,
      label: label || `Checkpoint before code generation`,
      createdAt: snapshot.createdAt,
      status: 'pending',
      fileCount: snapshot.metadata.fileCount,
    };

    // Store record
    const records = this.getRecords(projectId);
    records.push(record);

    // Prune old snapshots beyond the limit
    this.pruneSnapshots(projectId);

    // Persist to S3 asynchronously (fire-and-forget for speed)
    this.persistSnapshotToStorage(projectId, snapshot).catch((err) => {
      this.logger.warn(`Failed to persist snapshot ${snapshot.id} to storage: ${err}`);
    });

    this.logger.log(
      `Created checkpoint ${snapshot.id} for project ${projectId} (${snapshot.metadata.fileCount} files)`,
    );

    return record;
  }

  /**
   * Mark a checkpoint as confirmed good (validation passed after code generation).
   */
  confirmCheckpoint(projectId: string, snapshotId: string): void {
    const records = this.getRecords(projectId);
    const record = records.find((r) => r.id === snapshotId);
    if (record) {
      record.status = 'confirmed';
      // Update recovery state
      const state = this.getRecoveryState(projectId);
      state.lastGoodSnapshotId = snapshotId;
    }
  }

  /**
   * Rollback to a specific snapshot, restoring the VFS to that state.
   * If no snapshotId is given, rolls back to the latest confirmed good snapshot.
   */
  async rollback(projectId: string, snapshotId?: string): Promise<SnapshotRecord> {
    const manager = this.getSnapshotManager(projectId);
    const records = this.getRecords(projectId);
    const state = this.getRecoveryState(projectId);

    // Determine target snapshot
    let targetId = snapshotId;
    if (!targetId) {
      // Find the most recent confirmed or pending snapshot
      const target = [...records]
        .reverse()
        .find((r) => r.status === 'confirmed' || r.status === 'pending');
      if (!target) {
        throw new Error(`No snapshot available for rollback in project ${projectId}`);
      }
      targetId = target.id;
    }

    const targetRecord = records.find((r) => r.id === targetId);
    if (!targetRecord) {
      throw new Error(`Snapshot ${targetId} not found for project ${projectId}`);
    }

    // Perform the rollback
    state.recovering = true;
    try {
      const vfs = this.filesService.getProjectFS(projectId);
      manager.restoreSnapshot(targetId, vfs);

      targetRecord.status = 'rolled_back';
      state.rollbackCount++;
      state.lastRollbackAt = Date.now();
      state.lastGoodSnapshotId = targetId;

      this.logger.log(
        `Rolled back project ${projectId} to snapshot ${targetId} (${targetRecord.fileCount} files)`,
      );

      return targetRecord;
    } finally {
      state.recovering = false;
    }
  }

  /**
   * List all snapshots for a project.
   */
  listSnapshots(projectId: string): SnapshotRecord[] {
    return this.getRecords(projectId);
  }

  /**
   * Get the current recovery state for a project.
   */
  getStatus(projectId: string): RecoveryState {
    return this.getRecoveryState(projectId);
  }

  /**
   * Get a specific snapshot record.
   */
  getSnapshotRecord(projectId: string, snapshotId: string): SnapshotRecord | undefined {
    return this.getRecords(projectId).find((r) => r.id === snapshotId);
  }

  /**
   * Get the count of files that would be restored for a given snapshot.
   */
  getSnapshotFileCount(projectId: string, snapshotId: string): number {
    const manager = this.getSnapshotManager(projectId);
    const snapshot = manager.getSnapshot(snapshotId);
    if (!snapshot) {
      return 0;
    }
    // Count only file nodes (not directories)
    let count = 0;
    for (const node of snapshot.nodes.values()) {
      if (node.type === 'file') {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private getSnapshotManager(projectId: string): SnapshotManager {
    let manager = this.snapshotManagers.get(projectId);
    if (!manager) {
      manager = new SnapshotManager();
      this.snapshotManagers.set(projectId, manager);
    }
    return manager;
  }

  private getRecords(projectId: string): SnapshotRecord[] {
    let records = this.snapshotRecords.get(projectId);
    if (!records) {
      records = [];
      this.snapshotRecords.set(projectId, records);
    }
    return records;
  }

  private getRecoveryState(projectId: string): RecoveryState {
    let state = this.recoveryStates.get(projectId);
    if (!state) {
      state = {
        recovering: false,
        lastGoodSnapshotId: null,
        snapshotCount: 0,
        rollbackCount: 0,
        lastRollbackAt: null,
      };
      this.recoveryStates.set(projectId, state);
    }
    // Keep snapshotCount in sync
    state.snapshotCount = this.getRecords(projectId).length;
    return state;
  }

  /**
   * Prune snapshots to keep only the most recent MAX_SNAPSHOTS_PER_PROJECT.
   */
  private pruneSnapshots(projectId: string): void {
    const records = this.getRecords(projectId);
    const manager = this.getSnapshotManager(projectId);

    while (records.length > MAX_SNAPSHOTS_PER_PROJECT) {
      const oldest = records.shift();
      if (oldest) {
        manager.deleteSnapshot(oldest.id);
        this.logger.debug(`Pruned old snapshot ${oldest.id} for project ${projectId}`);
      }
    }
  }

  /**
   * Persist snapshot data to S3 for cross-restart durability.
   * Stores each file in the snapshot as a separate S3 object under a snapshot prefix.
   */
  private async persistSnapshotToStorage(
    projectId: string,
    snapshot: VFSSnapshot,
  ): Promise<void> {
    if (!this.filePersistence.available) {
      return;
    }

    // Persist snapshot metadata
    const metadataKey = `snapshots/${projectId}/${snapshot.id}/metadata.json`;
    const metadata = {
      id: snapshot.id,
      label: snapshot.label,
      createdAt: snapshot.createdAt,
      fileCount: snapshot.metadata.fileCount,
      projectName: snapshot.metadata.name,
    };

    await this.filePersistence.persistFile(
      projectId,
      metadataKey,
      JSON.stringify(metadata),
      'json',
    );

    // Persist individual files from the snapshot
    for (const [path, node] of snapshot.nodes) {
      if (node.type === 'file' && node.content) {
        const snapshotKey = `snapshots/${projectId}/${snapshot.id}${path}`;
        await this.filePersistence.persistFile(
          projectId,
          snapshotKey,
          node.content.text,
          node.content.language,
        );
      }
    }
  }
}

import { VirtualFileSystem } from '@builder/codegen';
import { Test, TestingModule } from '@nestjs/testing';

import { FilePersistenceService } from '../files/file-persistence.service';
import { FilesService } from '../files/files.service';

import { RecoveryService } from './recovery.service';

describe('RecoveryService', () => {
  let service: RecoveryService;
  let mockVFS: VirtualFileSystem;

  const mockFilesService = {
    getProjectFS: jest.fn(),
  };

  const mockFilePersistence = {
    available: false,
    persistFile: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockVFS = new VirtualFileSystem('test-project');
    mockFilesService.getProjectFS.mockReturnValue(mockVFS);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecoveryService,
        { provide: FilesService, useValue: mockFilesService },
        { provide: FilePersistenceService, useValue: mockFilePersistence },
      ],
    }).compile();

    service = module.get<RecoveryService>(RecoveryService);
    jest.clearAllMocks();
    mockFilesService.getProjectFS.mockReturnValue(mockVFS);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckpoint', () => {
    it('should create a snapshot of the current VFS state', async () => {
      mockVFS.createFile('/src/index.ts', 'console.log("hello")');
      mockVFS.createFile('/package.json', '{"name": "test"}');

      const record = await service.createCheckpoint('project-1', 'Before changes');

      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(record.projectId).toBe('project-1');
      expect(record.label).toBe('Before changes');
      expect(record.status).toBe('pending');
      expect(record.fileCount).toBe(2);
    });

    it('should create a snapshot even with empty VFS', async () => {
      const record = await service.createCheckpoint('project-1');

      expect(record).toBeDefined();
      expect(record.fileCount).toBe(0);
      expect(record.status).toBe('pending');
    });

    it('should persist to storage when available', async () => {
      mockFilePersistence.available = true;
      mockVFS.createFile('/src/app.ts', 'const app = true;');

      await service.createCheckpoint('project-1');

      // Wait for async persist to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFilePersistence.persistFile).toHaveBeenCalled();
      mockFilePersistence.available = false;
    });

    it('should maintain snapshot history', async () => {
      await service.createCheckpoint('project-1', 'Snapshot 1');
      await service.createCheckpoint('project-1', 'Snapshot 2');
      await service.createCheckpoint('project-1', 'Snapshot 3');

      const snapshots = service.listSnapshots('project-1');
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].label).toBe('Snapshot 1');
      expect(snapshots[2].label).toBe('Snapshot 3');
    });

    it('should prune snapshots beyond the max limit (10)', async () => {
      for (let i = 0; i < 12; i++) {
        await service.createCheckpoint('project-1', `Snapshot ${i}`);
      }

      const snapshots = service.listSnapshots('project-1');
      expect(snapshots).toHaveLength(10);
      // Oldest should have been pruned
      expect(snapshots[0].label).toBe('Snapshot 2');
      expect(snapshots[9].label).toBe('Snapshot 11');
    });
  });

  describe('confirmCheckpoint', () => {
    it('should mark a checkpoint as confirmed', async () => {
      const record = await service.createCheckpoint('project-1', 'Test');

      service.confirmCheckpoint('project-1', record.id);

      const snapshots = service.listSnapshots('project-1');
      expect(snapshots[0].status).toBe('confirmed');
    });

    it('should update lastGoodSnapshotId in recovery state', async () => {
      const record = await service.createCheckpoint('project-1', 'Test');

      service.confirmCheckpoint('project-1', record.id);

      const status = service.getStatus('project-1');
      expect(status.lastGoodSnapshotId).toBe(record.id);
    });
  });

  describe('rollback', () => {
    it('should restore VFS to the snapshot state', async () => {
      // Create initial file
      mockVFS.createFile('/src/index.ts', 'original content');

      // Create checkpoint
      const record = await service.createCheckpoint('project-1', 'Before changes');

      // Modify the file (simulating code generation)
      mockVFS.updateFile('/src/index.ts', 'modified content');
      mockVFS.createFile('/src/new-file.ts', 'new file');

      // Verify files were changed
      expect(mockVFS.readFile('/src/index.ts').content?.text).toBe('modified content');
      expect(mockVFS.exists('/src/new-file.ts')).toBe(true);

      // Rollback
      const result = await service.rollback('project-1', record.id);

      expect(result.id).toBe(record.id);
      expect(result.status).toBe('rolled_back');

      // Verify VFS was restored
      expect(mockVFS.readFile('/src/index.ts').content?.text).toBe('original content');
      expect(mockVFS.exists('/src/new-file.ts')).toBe(false);
    });

    it('should rollback to the latest snapshot when no ID is provided', async () => {
      mockVFS.createFile('/src/app.ts', 'version 1');
      const _record1 = await service.createCheckpoint('project-1', 'V1');

      mockVFS.updateFile('/src/app.ts', 'version 2');
      const record2 = await service.createCheckpoint('project-1', 'V2');

      mockVFS.updateFile('/src/app.ts', 'version 3');

      // Rollback without ID should use most recent
      const result = await service.rollback('project-1');
      expect(result.id).toBe(record2.id);
      expect(mockVFS.readFile('/src/app.ts').content?.text).toBe('version 2');
    });

    it('should throw when no snapshots are available', async () => {
      await expect(service.rollback('project-1')).rejects.toThrow(
        'No snapshot available for rollback',
      );
    });

    it('should throw when specified snapshot does not exist', async () => {
      await service.createCheckpoint('project-1');

      await expect(
        service.rollback('project-1', 'non-existent-id'),
      ).rejects.toThrow('Snapshot non-existent-id not found');
    });

    it('should increment rollback count in recovery state', async () => {
      mockVFS.createFile('/src/file.ts', 'content');
      await service.createCheckpoint('project-1');
      mockVFS.updateFile('/src/file.ts', 'changed');

      await service.rollback('project-1');

      const status = service.getStatus('project-1');
      expect(status.rollbackCount).toBe(1);
      expect(status.lastRollbackAt).not.toBeNull();
    });

    it('should handle multiple sequential rollbacks', async () => {
      mockVFS.createFile('/src/file.ts', 'v1');
      const snapshot1 = await service.createCheckpoint('project-1', 'V1');

      mockVFS.updateFile('/src/file.ts', 'v2');
      await service.createCheckpoint('project-1', 'V2');

      mockVFS.updateFile('/src/file.ts', 'v3');

      // Rollback to first snapshot
      await service.rollback('project-1', snapshot1.id);
      expect(mockVFS.readFile('/src/file.ts').content?.text).toBe('v1');

      const status = service.getStatus('project-1');
      expect(status.rollbackCount).toBe(1);
    });
  });

  describe('listSnapshots', () => {
    it('should return empty array when no snapshots exist', () => {
      const snapshots = service.listSnapshots('project-1');
      expect(snapshots).toEqual([]);
    });

    it('should return snapshots in creation order', async () => {
      await service.createCheckpoint('project-1', 'First');
      await service.createCheckpoint('project-1', 'Second');
      await service.createCheckpoint('project-1', 'Third');

      const snapshots = service.listSnapshots('project-1');
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].label).toBe('First');
      expect(snapshots[1].label).toBe('Second');
      expect(snapshots[2].label).toBe('Third');
    });

    it('should isolate snapshots between projects', async () => {
      await service.createCheckpoint('project-1', 'P1 Snapshot');
      await service.createCheckpoint('project-2', 'P2 Snapshot');

      expect(service.listSnapshots('project-1')).toHaveLength(1);
      expect(service.listSnapshots('project-2')).toHaveLength(1);
      expect(service.listSnapshots('project-1')[0].label).toBe('P1 Snapshot');
      expect(service.listSnapshots('project-2')[0].label).toBe('P2 Snapshot');
    });
  });

  describe('getStatus', () => {
    it('should return initial state for new project', () => {
      const status = service.getStatus('project-1');

      expect(status.recovering).toBe(false);
      expect(status.lastGoodSnapshotId).toBeNull();
      expect(status.snapshotCount).toBe(0);
      expect(status.rollbackCount).toBe(0);
      expect(status.lastRollbackAt).toBeNull();
    });

    it('should reflect snapshot count', async () => {
      await service.createCheckpoint('project-1');
      await service.createCheckpoint('project-1');

      const status = service.getStatus('project-1');
      expect(status.snapshotCount).toBe(2);
    });
  });

  describe('getSnapshotFileCount', () => {
    it('should return file count for a valid snapshot', async () => {
      mockVFS.createFile('/src/a.ts', 'a');
      mockVFS.createFile('/src/b.ts', 'b');
      mockVFS.createFile('/src/c.ts', 'c');

      const record = await service.createCheckpoint('project-1');

      const count = service.getSnapshotFileCount('project-1', record.id);
      expect(count).toBe(3);
    });

    it('should return 0 for non-existent snapshot', () => {
      const count = service.getSnapshotFileCount('project-1', 'non-existent');
      expect(count).toBe(0);
    });
  });
});

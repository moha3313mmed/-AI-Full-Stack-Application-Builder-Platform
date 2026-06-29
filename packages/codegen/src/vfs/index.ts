export type {
  VFSNodeType,
  VFSNode,
  FileContent,
  FileOperationType,
  FileOperation,
  FileChange,
  ProjectFileTree,
  VFSSnapshot,
  FileTreeNode,
} from './types.js';

export { VirtualFileSystem } from './virtual-file-system.js';
export { FileDiffer, type PatchData } from './file-differ.js';
export { SnapshotManager, type SnapshotDiff } from './snapshot.js';

// ============================================================================
// Virtual File System Types
// ============================================================================

/**
 * Type of a node in the virtual file system.
 */
export type VFSNodeType = 'file' | 'directory';

/**
 * Represents a single node (file or directory) in the virtual file tree.
 */
export interface VFSNode {
  /** Unique identifier for the node */
  id: string;
  /** Name of the file or directory */
  name: string;
  /** Full path from root (e.g., '/src/index.ts') */
  path: string;
  /** Whether this is a file or directory */
  type: VFSNodeType;
  /** File content (only for files) */
  content?: FileContent;
  /** Child node paths (only for directories) */
  children?: string[];
  /** Parent path (null for root) */
  parentPath: string | null;
  /** Creation timestamp */
  createdAt: number;
  /** Last modification timestamp */
  updatedAt: number;
}

/**
 * Content metadata for a file node.
 */
export interface FileContent {
  /** The text content of the file */
  text: string;
  /** Programming language or file type */
  language?: string;
  /** Content encoding (default: utf-8) */
  encoding?: string;
}

/**
 * Types of operations that can be performed on the file system.
 */
export type FileOperationType = 'create' | 'update' | 'delete' | 'move' | 'rename';

/**
 * A single file operation to apply to the VFS.
 */
export interface FileOperation {
  /** Type of operation */
  type: FileOperationType;
  /** Target file path */
  path: string;
  /** New content (for create/update) */
  content?: string;
  /** Language hint (for create/update) */
  language?: string;
  /** Destination path (for move) */
  destination?: string;
  /** New name (for rename) */
  newName?: string;
}

/**
 * Tracks a single file change with before/after content.
 */
export interface FileChange {
  /** The file path */
  path: string;
  /** Type of change */
  type: FileOperationType;
  /** Content before the change (null for create) */
  before: string | null;
  /** Content after the change (null for delete) */
  after: string | null;
  /** Timestamp of the change */
  timestamp: number;
}

/**
 * Metadata for the project file tree.
 */
export interface ProjectFileTree {
  /** Project name */
  name: string;
  /** Root path of the project */
  rootPath: string;
  /** Total number of files */
  fileCount: number;
  /** Total number of directories */
  directoryCount: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last modification timestamp */
  updatedAt: number;
}

/**
 * A serialized snapshot of the entire file tree.
 */
export interface VFSSnapshot {
  /** Unique snapshot identifier */
  id: string;
  /** Human-readable label */
  label?: string;
  /** Timestamp when snapshot was taken */
  createdAt: number;
  /** Serialized file tree data */
  nodes: Map<string, VFSNode>;
  /** Project metadata at snapshot time */
  metadata: ProjectFileTree;
}

/**
 * A nested tree node for UI rendering.
 */
export interface FileTreeNode {
  /** Name of the file or directory */
  name: string;
  /** Full path from root */
  path: string;
  /** Whether this is a file or directory */
  type: 'file' | 'directory';
  /** Child nodes (only for directories) */
  children?: FileTreeNode[];
}

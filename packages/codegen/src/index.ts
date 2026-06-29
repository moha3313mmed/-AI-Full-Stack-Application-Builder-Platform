// @builder/codegen - Virtual File System and Code Generation Engine
//
// This package provides an in-memory virtual file system for managing
// project file trees, diff tracking, snapshots, and AI-powered code
// generation with template-based project scaffolding.

// ============================================================================
// VFS - Virtual File System
// ============================================================================

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
} from './vfs/index.js';

export { VirtualFileSystem } from './vfs/index.js';
export { FileDiffer, type PatchData } from './vfs/index.js';
export { SnapshotManager, type SnapshotDiff } from './vfs/index.js';

// ============================================================================
// Code Generation
// ============================================================================

export type {
  Framework,
  Language,
  CodeGenRequest,
  CodeGenResult,
  FileContext,
  TemplateConfig,
  ScaffoldConfig,
} from './codegen/index.js';

export { CodeGenerator } from './codegen/index.js';
export { TemplateEngine } from './codegen/index.js';
export { PromptBuilder } from './codegen/index.js';

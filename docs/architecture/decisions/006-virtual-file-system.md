# ADR 006: Virtual File System with In-Memory File Tree

## Status

Accepted

## Context

The AI Builder Platform needs a file system abstraction to manage user project files during the code generation and editing workflow. Each project consists of a tree of source files that must be created, read, updated, deleted, moved, and searched. Requirements include:

- Fast path-based lookups for individual file operations
- Directory tree traversal for file explorer rendering
- Change tracking to detect what was modified between operations
- Point-in-time snapshots for undo/redo and version comparison
- Glob-based pattern matching for framework-aware operations
- Isolation between concurrent user sessions

Options considered:
- **Real filesystem (OS-level)**: Write files to disk, use Node.js `fs` module
- **Git-backed storage**: Store project files in a git repository per project
- **In-memory Map-based virtual file system**: Keep the entire file tree in memory with path-indexed lookups
- **Database-backed file store**: Store file contents in PostgreSQL or a document database

## Decision

We will implement an **in-memory Virtual File System (VFS)** in the `@builder/codegen` package (`packages/codegen/src/vfs/`). The VFS uses a `Map<string, VFSNode>` for O(1) path-based lookups and maintains a tree structure via parent/child path references.

### Core Components

1. **`VirtualFileSystem`** (`src/vfs/virtual-file-system.ts`): The primary file tree implementation. Stores all nodes in a flat `Map` keyed by normalized path. Supports `createFile`, `readFile`, `updateFile`, `deleteFile`, `moveFile`, `listDirectory`, `glob`, and `getTree` operations. Automatically creates intermediate directories and detects file language from extension.

2. **`FileDiffer`** (`src/vfs/file-differ.ts`): Tracks file changes as an ordered log of `FileChange` entries, each recording path, operation type, before/after content, and timestamp. Supports `generatePatch` for producing a serializable diff and `applyPatch` for replaying changes.

3. **`SnapshotManager`** (`src/vfs/snapshot.ts`): Creates point-in-time deep clones of the entire VFS state. Snapshots are stored in a separate `Map<string, VFSSnapshot>` and can be restored to roll back the file tree. Supports `diffSnapshots` for comparing two points in time.

### Data Model

```typescript
interface VFSNode {
  id: string;           // UUID
  name: string;         // File or directory name
  path: string;         // Full normalized path (e.g., '/src/index.ts')
  type: 'file' | 'directory';
  content?: FileContent; // text, language, encoding (files only)
  children?: string[];   // Child paths (directories only)
  parentPath: string | null;
  createdAt: number;
  updatedAt: number;
}
```

### File Operation Abstraction

All mutations (from AI generation, templates, or user edits) are expressed as `FileOperation` objects:

```typescript
interface FileOperation {
  type: 'create' | 'update' | 'delete' | 'move';
  path: string;
  content?: string;
  newPath?: string;  // For move operations
}
```

This abstraction decouples the code generation engine from the storage layer, allowing operations to be batched, previewed, and applied atomically.

## Consequences

### Positive

- **O(1) path lookups**: The `Map`-based design ensures file reads, writes, and existence checks are constant-time regardless of tree size
- **Complete isolation**: Each project session gets its own VFS instance with no filesystem side effects, preventing cross-user interference
- **Snapshot/restore**: Undo operations and version comparison are trivial since the entire state can be deep-cloned and restored
- **Change tracking**: The `FileDiffer` maintains a full audit trail of every operation, enabling diff views and patch generation
- **Framework-agnostic**: The `FileOperation` abstraction works identically whether changes come from AI generation, template scaffolding, or manual edits
- **Testability**: No filesystem mocking required; tests operate entirely in-memory with predictable behavior
- **Serializable state**: The entire VFS can be serialized to JSON for persistence or transfer between services

### Negative

- **Memory pressure**: Large projects with many files or large binary assets consume heap memory proportional to total content size
- **No persistence by default**: If the server process terminates, unsaved VFS state is lost unless explicitly serialized
- **No concurrent write safety**: The current implementation assumes single-writer access per VFS instance; multi-user collaborative editing would require additional synchronization
- **Deep clone cost**: Snapshot creation deep-clones every node, which scales linearly with file count

### Mitigations

- Project files in AI builder workflows are typically source code (small text files), keeping memory usage manageable
- **MVP limitation**: VFS state is purely in-memory with no persistence. A server restart loses all project files. This is acceptable for the MVP phase where sessions are short-lived. A persistence layer (database or object storage) will be added in a future iteration before production deployment.
- The WebSocket gateway (`FilesGateway`) broadcasts change events so multiple clients stay synchronized without requiring concurrent writes to the same VFS instance
- Snapshot frequency can be tuned (e.g., only on explicit user actions) to avoid excessive cloning
- Future optimization: copy-on-write snapshots or structural sharing to reduce clone cost
- Per-project VFS instances are not evicted in the current MVP; a TTL-based eviction strategy should be added before multi-tenant production use

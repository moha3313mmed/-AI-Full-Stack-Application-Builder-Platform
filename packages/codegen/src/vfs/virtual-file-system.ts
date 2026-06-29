import { randomUUID } from 'node:crypto';

import type { VFSNode, FileContent, FileTreeNode, ProjectFileTree } from './types.js';

// ============================================================================
// Virtual File System Implementation
// ============================================================================

/**
 * In-memory virtual file system with O(1) path lookups.
 * Supports file and directory CRUD, path resolution, and glob matching.
 */
export class VirtualFileSystem {
  private nodes: Map<string, VFSNode> = new Map();
  private projectName: string;
  private createdAt: number;

  constructor(projectName: string = 'untitled') {
    this.projectName = projectName;
    this.createdAt = Date.now();

    // Create root directory
    const root: VFSNode = {
      id: randomUUID(),
      name: projectName,
      path: '/',
      type: 'directory',
      children: [],
      parentPath: null,
      createdAt: this.createdAt,
      updatedAt: this.createdAt,
    };
    this.nodes.set('/', root);
  }

  /**
   * Create a new file at the specified path.
   */
  createFile(path: string, content: string, language?: string): VFSNode {
    const normalizedPath = this.normalizePath(path);

    if (this.nodes.has(normalizedPath)) {
      throw new Error(`File already exists at path: ${normalizedPath}`);
    }

    // Ensure parent directory exists
    const parentPath = this.getParentPath(normalizedPath);
    this.ensureDirectoryExists(parentPath);

    const name = this.getBaseName(normalizedPath);
    const now = Date.now();

    const fileNode: VFSNode = {
      id: randomUUID(),
      name,
      path: normalizedPath,
      type: 'file',
      content: {
        text: content,
        language: language || this.detectLanguage(name),
        encoding: 'utf-8',
      },
      parentPath,
      createdAt: now,
      updatedAt: now,
    };

    this.nodes.set(normalizedPath, fileNode);

    // Add to parent's children
    const parent = this.nodes.get(parentPath)!;
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(normalizedPath);
    parent.updatedAt = now;

    return fileNode;
  }

  /**
   * Read a file at the specified path.
   */
  readFile(path: string): VFSNode {
    const normalizedPath = this.normalizePath(path);
    const node = this.nodes.get(normalizedPath);

    if (!node) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    if (node.type !== 'file') {
      throw new Error(`Path is a directory, not a file: ${normalizedPath}`);
    }

    return node;
  }

  /**
   * Update the content of a file.
   */
  updateFile(path: string, content: string, language?: string): VFSNode {
    const normalizedPath = this.normalizePath(path);
    const node = this.nodes.get(normalizedPath);

    if (!node) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    if (node.type !== 'file') {
      throw new Error(`Path is a directory, not a file: ${normalizedPath}`);
    }

    const fileContent: FileContent = {
      text: content,
      language: language || node.content?.language || this.detectLanguage(node.name),
      encoding: 'utf-8',
    };

    node.content = fileContent;
    node.updatedAt = Date.now();

    return node;
  }

  /**
   * Delete a file or empty directory at the specified path.
   */
  deleteFile(path: string): void {
    const normalizedPath = this.normalizePath(path);

    if (normalizedPath === '/') {
      throw new Error('Cannot delete root directory');
    }

    const node = this.nodes.get(normalizedPath);

    if (!node) {
      throw new Error(`Path not found: ${normalizedPath}`);
    }

    if (node.type === 'directory' && node.children && node.children.length > 0) {
      throw new Error(`Directory is not empty: ${normalizedPath}`);
    }

    // Remove from parent's children
    if (node.parentPath) {
      const parent = this.nodes.get(node.parentPath);
      if (parent && parent.children) {
        parent.children = parent.children.filter((child) => child !== normalizedPath);
        parent.updatedAt = Date.now();
      }
    }

    this.nodes.delete(normalizedPath);
  }

  /**
   * Recursively delete a directory and all its contents.
   */
  deleteDirectory(path: string): void {
    const normalizedPath = this.normalizePath(path);

    if (normalizedPath === '/') {
      throw new Error('Cannot delete root directory');
    }

    const node = this.nodes.get(normalizedPath);

    if (!node) {
      throw new Error(`Directory not found: ${normalizedPath}`);
    }

    if (node.type !== 'directory') {
      throw new Error(`Path is not a directory: ${normalizedPath}`);
    }

    // Recursively delete children
    if (node.children) {
      for (const childPath of [...node.children]) {
        const child = this.nodes.get(childPath);
        if (child?.type === 'directory') {
          this.deleteDirectory(childPath);
        } else {
          this.nodes.delete(childPath);
        }
      }
    }

    // Remove from parent's children
    if (node.parentPath) {
      const parent = this.nodes.get(node.parentPath);
      if (parent && parent.children) {
        parent.children = parent.children.filter((child) => child !== normalizedPath);
        parent.updatedAt = Date.now();
      }
    }

    this.nodes.delete(normalizedPath);
  }

  /**
   * Create a directory at the specified path.
   */
  createDirectory(path: string): VFSNode {
    const normalizedPath = this.normalizePath(path);

    if (this.nodes.has(normalizedPath)) {
      const existing = this.nodes.get(normalizedPath)!;
      if (existing.type === 'directory') {
        return existing;
      }
      throw new Error(`A file already exists at path: ${normalizedPath}`);
    }

    // Ensure parent directory exists
    const parentPath = this.getParentPath(normalizedPath);
    this.ensureDirectoryExists(parentPath);

    const name = this.getBaseName(normalizedPath);
    const now = Date.now();

    const dirNode: VFSNode = {
      id: randomUUID(),
      name,
      path: normalizedPath,
      type: 'directory',
      children: [],
      parentPath,
      createdAt: now,
      updatedAt: now,
    };

    this.nodes.set(normalizedPath, dirNode);

    // Add to parent's children
    const parent = this.nodes.get(parentPath)!;
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(normalizedPath);
    parent.updatedAt = now;

    return dirNode;
  }

  /**
   * Move a node to a new location.
   */
  moveNode(sourcePath: string, destinationPath: string): VFSNode {
    const normalizedSource = this.normalizePath(sourcePath);
    const normalizedDest = this.normalizePath(destinationPath);

    const node = this.nodes.get(normalizedSource);
    if (!node) {
      throw new Error(`Source path not found: ${normalizedSource}`);
    }

    if (this.nodes.has(normalizedDest)) {
      throw new Error(`Destination path already exists: ${normalizedDest}`);
    }

    // Ensure destination parent exists
    const destParent = this.getParentPath(normalizedDest);
    this.ensureDirectoryExists(destParent);

    // Remove from old parent
    if (node.parentPath) {
      const oldParent = this.nodes.get(node.parentPath);
      if (oldParent && oldParent.children) {
        oldParent.children = oldParent.children.filter((child) => child !== normalizedSource);
        oldParent.updatedAt = Date.now();
      }
    }

    // Delete old entry
    this.nodes.delete(normalizedSource);

    // Update node
    const newName = this.getBaseName(normalizedDest);
    node.path = normalizedDest;
    node.name = newName;
    node.parentPath = destParent;
    node.updatedAt = Date.now();

    // Add to new location
    this.nodes.set(normalizedDest, node);

    // Add to new parent
    const newParent = this.nodes.get(destParent)!;
    if (!newParent.children) {
      newParent.children = [];
    }
    newParent.children.push(normalizedDest);
    newParent.updatedAt = Date.now();

    // If directory, update all children paths recursively
    if (node.type === 'directory' && node.children) {
      this.updateChildPaths(normalizedSource, normalizedDest, node);
    }

    return node;
  }

  /**
   * Rename a node.
   */
  renameNode(path: string, newName: string): VFSNode {
    const normalizedPath = this.normalizePath(path);
    const parentPath = this.getParentPath(normalizedPath);
    const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;

    return this.moveNode(normalizedPath, newPath);
  }

  /**
   * List the contents of a directory.
   */
  listDirectory(path: string): VFSNode[] {
    const normalizedPath = this.normalizePath(path);
    const node = this.nodes.get(normalizedPath);

    if (!node) {
      throw new Error(`Directory not found: ${normalizedPath}`);
    }

    if (node.type !== 'directory') {
      throw new Error(`Path is not a directory: ${normalizedPath}`);
    }

    const children: VFSNode[] = [];
    if (node.children) {
      for (const childPath of node.children) {
        const child = this.nodes.get(childPath);
        if (child) {
          children.push(child);
        }
      }
    }

    return children;
  }

  /**
   * Get the entire file tree structure.
   */
  getTree(): ProjectFileTree {
    let fileCount = 0;
    let directoryCount = 0;

    for (const node of this.nodes.values()) {
      if (node.type === 'file') fileCount++;
      else if (node.type === 'directory' && node.path !== '/') directoryCount++;
    }

    return {
      name: this.projectName,
      rootPath: '/',
      fileCount,
      directoryCount,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
    };
  }

  /**
   * Serialize the VFS into a nested tree structure suitable for UI rendering.
   * Returns an array of FileTreeNode objects representing the root's children.
   */
  getFileTree(): FileTreeNode[] {
    const root = this.nodes.get('/');
    if (!root || !root.children) return [];

    return this.buildTreeNodes(root.children);
  }

  private buildTreeNodes(childPaths: string[]): FileTreeNode[] {
    const nodes: FileTreeNode[] = [];

    for (const childPath of childPaths) {
      const node = this.nodes.get(childPath);
      if (!node) continue;

      const treeNode: FileTreeNode = {
        name: node.name,
        path: node.path,
        type: node.type,
      };

      if (node.type === 'directory' && node.children) {
        treeNode.children = this.buildTreeNodes(node.children);
      }

      nodes.push(treeNode);
    }

    return nodes;
  }

  /**
   * Find a node by its path.
   */
  findByPath(path: string): VFSNode | undefined {
    const normalizedPath = this.normalizePath(path);
    return this.nodes.get(normalizedPath);
  }

  /**
   * Find files matching a glob-like pattern.
   * Supports * (match any chars except /) and ** (match any path segments).
   */
  glob(pattern: string): VFSNode[] {
    const regex = this.globToRegex(pattern);
    const results: VFSNode[] = [];

    for (const [path, node] of this.nodes) {
      if (node.type === 'file' && regex.test(path)) {
        results.push(node);
      }
    }

    return results;
  }

  /**
   * Check if a path exists in the VFS.
   */
  exists(path: string): boolean {
    return this.nodes.has(this.normalizePath(path));
  }

  /**
   * Get all nodes in the VFS (for serialization).
   */
  getAllNodes(): Map<string, VFSNode> {
    return new Map(this.nodes);
  }

  /**
   * Restore the VFS from a set of nodes.
   */
  restoreFromNodes(nodes: Map<string, VFSNode>, metadata: ProjectFileTree): void {
    this.nodes = new Map(nodes);
    this.projectName = metadata.name;
    this.createdAt = metadata.createdAt;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private normalizePath(path: string): string {
    // Ensure path starts with /
    let normalized = path.startsWith('/') ? path : `/${path}`;
    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    // Collapse multiple slashes
    normalized = normalized.replace(/\/+/g, '/');
    // Resolve '..' and '.' segments to prevent path traversal
    const segments = normalized.split('/');
    const resolved: string[] = [];
    for (const segment of segments) {
      if (segment === '' || segment === '.') {
        // Skip empty segments (from leading slash) and current-dir refs
        if (resolved.length === 0) resolved.push('');
        continue;
      }
      if (segment === '..') {
        // Do not allow traversal above root
        if (resolved.length > 1) {
          resolved.pop();
        }
      } else {
        resolved.push(segment);
      }
    }
    normalized = resolved.length <= 1 ? '/' : resolved.join('/');
    return normalized;
  }

  private getParentPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash <= 0) return '/';
    return path.slice(0, lastSlash);
  }

  private getBaseName(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return path.slice(lastSlash + 1);
  }

  private ensureDirectoryExists(path: string): void {
    if (this.nodes.has(path)) {
      const existing = this.nodes.get(path)!;
      if (existing.type !== 'directory') {
        throw new Error(`Path exists but is not a directory: ${path}`);
      }
      return;
    }

    // Recursively create parent directories
    const parentPath = this.getParentPath(path);
    if (parentPath !== path) {
      this.ensureDirectoryExists(parentPath);
    }

    const name = this.getBaseName(path);
    const now = Date.now();

    const dirNode: VFSNode = {
      id: randomUUID(),
      name,
      path,
      type: 'directory',
      children: [],
      parentPath,
      createdAt: now,
      updatedAt: now,
    };

    this.nodes.set(path, dirNode);

    // Add to parent
    const parent = this.nodes.get(parentPath);
    if (parent) {
      if (!parent.children) parent.children = [];
      parent.children.push(path);
      parent.updatedAt = now;
    }
  }

  private updateChildPaths(oldBase: string, newBase: string, node: VFSNode): void {
    if (!node.children) return;

    const updatedChildren: string[] = [];
    for (const oldChildPath of node.children) {
      const child = this.nodes.get(oldChildPath);
      if (!child) continue;

      // Remove old entry
      this.nodes.delete(oldChildPath);

      // Compute new path
      const relativePart = oldChildPath.slice(oldBase.length);
      const newChildPath = newBase + relativePart;

      child.path = newChildPath;
      child.parentPath = newBase;
      child.updatedAt = Date.now();

      this.nodes.set(newChildPath, child);
      updatedChildren.push(newChildPath);

      // Recursively update nested children
      if (child.type === 'directory' && child.children) {
        this.updateChildPaths(oldChildPath, newChildPath, child);
      }
    }

    node.children = updatedChildren;
  }

  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescriptreact',
      js: 'javascript',
      jsx: 'javascriptreact',
      json: 'json',
      md: 'markdown',
      css: 'css',
      scss: 'scss',
      html: 'html',
      yaml: 'yaml',
      yml: 'yaml',
      py: 'python',
      sh: 'shell',
      bash: 'shell',
    };
    return languageMap[ext || ''] || 'plaintext';
  }

  private globToRegex(pattern: string): RegExp {
    let regexStr = '^';
    const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`;

    let i = 0;
    while (i < normalized.length) {
      const char = normalized[i];
      if (char === '*' && normalized[i + 1] === '*') {
        // ** matches any path segments
        regexStr += '.*';
        i += 2;
        // Skip trailing slash after **
        if (normalized[i] === '/') i++;
      } else if (char === '*') {
        // * matches anything except /
        regexStr += '[^/]*';
        i++;
      } else if (char === '?') {
        regexStr += '[^/]';
        i++;
      } else if ('.+^${}()|[]\\'.includes(char)) {
        regexStr += '\\' + char;
        i++;
      } else {
        regexStr += char;
        i++;
      }
    }

    regexStr += '$';
    return new RegExp(regexStr);
  }
}

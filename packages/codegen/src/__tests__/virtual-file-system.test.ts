import { describe, it, expect, beforeEach } from 'vitest';

import { VirtualFileSystem } from '../vfs/virtual-file-system.js';

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem('test-project');
  });

  describe('File CRUD', () => {
    it('should create a file', () => {
      const node = vfs.createFile('/src/index.ts', 'console.log("hello")');
      expect(node.type).toBe('file');
      expect(node.name).toBe('index.ts');
      expect(node.path).toBe('/src/index.ts');
      expect(node.content?.text).toBe('console.log("hello")');
    });

    it('should auto-detect language from extension', () => {
      const node = vfs.createFile('/src/app.tsx', '<App />');
      expect(node.content?.language).toBe('typescriptreact');
    });

    it('should use provided language override', () => {
      const node = vfs.createFile('/config', 'data', 'yaml');
      expect(node.content?.language).toBe('yaml');
    });

    it('should read a file', () => {
      vfs.createFile('/readme.md', '# Hello');
      const node = vfs.readFile('/readme.md');
      expect(node.content?.text).toBe('# Hello');
      expect(node.content?.language).toBe('markdown');
    });

    it('should throw when reading non-existent file', () => {
      expect(() => vfs.readFile('/missing.ts')).toThrow('File not found');
    });

    it('should throw when reading a directory as file', () => {
      vfs.createDirectory('/src');
      expect(() => vfs.readFile('/src')).toThrow('Path is a directory');
    });

    it('should update a file', () => {
      vfs.createFile('/src/index.ts', 'old content');
      const updated = vfs.updateFile('/src/index.ts', 'new content');
      expect(updated.content?.text).toBe('new content');
    });

    it('should throw when updating non-existent file', () => {
      expect(() => vfs.updateFile('/missing.ts', 'content')).toThrow('File not found');
    });

    it('should delete a file', () => {
      vfs.createFile('/src/index.ts', 'content');
      vfs.deleteFile('/src/index.ts');
      expect(vfs.exists('/src/index.ts')).toBe(false);
    });

    it('should throw when deleting non-existent file', () => {
      expect(() => vfs.deleteFile('/missing.ts')).toThrow('Path not found');
    });

    it('should throw when file already exists at path', () => {
      vfs.createFile('/src/index.ts', 'content');
      expect(() => vfs.createFile('/src/index.ts', 'duplicate')).toThrow('File already exists');
    });

    it('should throw when deleting root directory', () => {
      expect(() => vfs.deleteFile('/')).toThrow('Cannot delete root');
    });
  });

  describe('Directory Operations', () => {
    it('should create a directory', () => {
      const dir = vfs.createDirectory('/src');
      expect(dir.type).toBe('directory');
      expect(dir.name).toBe('src');
      expect(dir.path).toBe('/src');
    });

    it('should return existing directory on duplicate create', () => {
      const dir1 = vfs.createDirectory('/src');
      const dir2 = vfs.createDirectory('/src');
      expect(dir1.id).toBe(dir2.id);
    });

    it('should auto-create parent directories for files', () => {
      vfs.createFile('/src/components/Button.tsx', '<button />');
      expect(vfs.exists('/src')).toBe(true);
      expect(vfs.exists('/src/components')).toBe(true);
    });

    it('should list directory contents', () => {
      vfs.createFile('/src/a.ts', 'a');
      vfs.createFile('/src/b.ts', 'b');
      const listing = vfs.listDirectory('/src');
      expect(listing).toHaveLength(2);
      expect(listing.map((n) => n.name).sort()).toEqual(['a.ts', 'b.ts']);
    });

    it('should throw when listing non-existent directory', () => {
      expect(() => vfs.listDirectory('/missing')).toThrow('Directory not found');
    });

    it('should throw when listing a file as directory', () => {
      vfs.createFile('/file.ts', 'content');
      expect(() => vfs.listDirectory('/file.ts')).toThrow('not a directory');
    });

    it('should not delete non-empty directory with deleteFile', () => {
      vfs.createFile('/src/index.ts', 'content');
      expect(() => vfs.deleteFile('/src')).toThrow('not empty');
    });

    it('should recursively delete a directory', () => {
      vfs.createFile('/src/a.ts', 'a');
      vfs.createFile('/src/nested/b.ts', 'b');
      vfs.deleteDirectory('/src');
      expect(vfs.exists('/src')).toBe(false);
      expect(vfs.exists('/src/a.ts')).toBe(false);
      expect(vfs.exists('/src/nested/b.ts')).toBe(false);
    });
  });

  describe('Path Resolution', () => {
    it('should normalize paths without leading slash', () => {
      const node = vfs.createFile('src/index.ts', 'content');
      expect(node.path).toBe('/src/index.ts');
    });

    it('should remove trailing slashes', () => {
      const dir = vfs.createDirectory('/src/');
      expect(dir.path).toBe('/src');
    });

    it('should find nodes by path', () => {
      vfs.createFile('/src/index.ts', 'content');
      const found = vfs.findByPath('/src/index.ts');
      expect(found).toBeDefined();
      expect(found?.name).toBe('index.ts');
    });

    it('should return undefined for non-existent path', () => {
      const found = vfs.findByPath('/missing');
      expect(found).toBeUndefined();
    });

    it('should check existence', () => {
      vfs.createFile('/src/index.ts', 'content');
      expect(vfs.exists('/src/index.ts')).toBe(true);
      expect(vfs.exists('/missing')).toBe(false);
    });
  });

  describe('Move and Rename', () => {
    it('should move a file to a new location', () => {
      vfs.createFile('/src/old.ts', 'content');
      const moved = vfs.moveNode('/src/old.ts', '/lib/new.ts');
      expect(moved.path).toBe('/lib/new.ts');
      expect(moved.name).toBe('new.ts');
      expect(vfs.exists('/src/old.ts')).toBe(false);
      expect(vfs.exists('/lib/new.ts')).toBe(true);
    });

    it('should rename a file', () => {
      vfs.createFile('/src/old.ts', 'content');
      const renamed = vfs.renameNode('/src/old.ts', 'new.ts');
      expect(renamed.path).toBe('/src/new.ts');
      expect(renamed.name).toBe('new.ts');
    });

    it('should throw when moving non-existent node', () => {
      expect(() => vfs.moveNode('/missing', '/dest')).toThrow('Source path not found');
    });

    it('should throw when destination already exists', () => {
      vfs.createFile('/a.ts', 'a');
      vfs.createFile('/b.ts', 'b');
      expect(() => vfs.moveNode('/a.ts', '/b.ts')).toThrow('Destination path already exists');
    });
  });

  describe('Glob Matching', () => {
    beforeEach(() => {
      vfs.createFile('/src/index.ts', 'index');
      vfs.createFile('/src/utils.ts', 'utils');
      vfs.createFile('/src/components/Button.tsx', 'button');
      vfs.createFile('/src/components/Input.tsx', 'input');
      vfs.createFile('/README.md', 'readme');
    });

    it('should match files with * pattern', () => {
      const results = vfs.glob('/src/*.ts');
      expect(results).toHaveLength(2);
    });

    it('should match files with ** pattern', () => {
      const results = vfs.glob('**/*.tsx');
      expect(results).toHaveLength(2);
    });

    it('should match all files with **/*', () => {
      const results = vfs.glob('**/*');
      expect(results.length).toBeGreaterThanOrEqual(5);
    });

    it('should match specific extension', () => {
      const results = vfs.glob('**/*.md');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('README.md');
    });
  });

  describe('Tree Operations', () => {
    it('should return project file tree metadata', () => {
      vfs.createFile('/src/index.ts', 'content');
      vfs.createFile('/src/utils.ts', 'utils');
      const tree = vfs.getTree();
      expect(tree.name).toBe('test-project');
      expect(tree.fileCount).toBe(2);
      expect(tree.directoryCount).toBe(1); // /src
    });

    it('should return all nodes', () => {
      vfs.createFile('/a.ts', 'a');
      const nodes = vfs.getAllNodes();
      expect(nodes.size).toBeGreaterThan(1); // root + /a.ts
    });
  });
});

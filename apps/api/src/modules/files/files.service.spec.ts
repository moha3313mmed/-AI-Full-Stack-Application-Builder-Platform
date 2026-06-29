import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { FilePersistenceService } from './file-persistence.service';
import { FilesGateway } from './files.gateway';
import { FilesService } from './files.service';

describe('FilesService', () => {
  let service: FilesService;

  const mockFilesGateway = {
    emitFileCreated: jest.fn(),
    emitFileUpdated: jest.fn(),
    emitFileDeleted: jest.fn(),
    emitFileMoved: jest.fn(),
  };

  const mockFilePersistence = {
    available: false,
    persistFile: jest.fn().mockResolvedValue(undefined),
    deletePersistedFile: jest.fn().mockResolvedValue(undefined),
    loadProjectFiles: jest.fn().mockResolvedValue([]),
    hasPersistedFiles: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: FilesGateway, useValue: mockFilesGateway },
        { provide: FilePersistenceService, useValue: mockFilePersistence },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProjectFS', () => {
    it('should create a new VFS for a project', () => {
      const vfs = service.getProjectFS('project-1');
      expect(vfs).toBeDefined();
    });

    it('should return the same VFS for the same project', () => {
      const vfs1 = service.getProjectFS('project-1');
      const vfs2 = service.getProjectFS('project-1');
      expect(vfs1).toBe(vfs2);
    });

    it('should return different VFS instances for different projects', () => {
      const vfs1 = service.getProjectFS('project-1');
      const vfs2 = service.getProjectFS('project-2');
      expect(vfs1).not.toBe(vfs2);
    });
  });

  describe('createFile', () => {
    it('should create a file and return the node', () => {
      const node = service.createFile('project-1', '/src/index.ts', 'const x = 1;');
      expect(node.path).toBe('/src/index.ts');
      expect(node.content?.text).toBe('const x = 1;');
      expect(node.type).toBe('file');
    });

    it('should emit file:created event via gateway', () => {
      service.createFile('project-1', '/src/app.ts', 'export {}');
      expect(mockFilesGateway.emitFileCreated).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ path: '/src/app.ts' }),
      );
    });

    it('should create a file with a language hint', () => {
      const node = service.createFile('project-1', '/style.css', 'body {}', 'css');
      expect(node.content?.language).toBe('css');
    });
  });

  describe('readFile', () => {
    it('should read an existing file', () => {
      service.createFile('project-1', '/src/hello.ts', 'hello');
      const node = service.readFile('project-1', '/src/hello.ts');
      expect(node.content?.text).toBe('hello');
    });

    it('should throw NotFoundException for non-existent file', () => {
      service.getProjectFS('project-1');
      expect(() => service.readFile('project-1', '/does-not-exist.ts')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateFile', () => {
    it('should update file content', () => {
      service.createFile('project-1', '/src/index.ts', 'old content');
      const updated = service.updateFile('project-1', '/src/index.ts', 'new content');
      expect(updated.content?.text).toBe('new content');
    });

    it('should emit file:updated event via gateway', () => {
      service.createFile('project-1', '/src/index.ts', 'old');
      service.updateFile('project-1', '/src/index.ts', 'new');
      expect(mockFilesGateway.emitFileUpdated).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ path: '/src/index.ts' }),
      );
    });

    it('should throw NotFoundException for non-existent file', () => {
      service.getProjectFS('project-1');
      expect(() =>
        service.updateFile('project-1', '/missing.ts', 'content'),
      ).toThrow(NotFoundException);
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', () => {
      service.createFile('project-1', '/src/temp.ts', 'temp');
      service.deleteFile('project-1', '/src/temp.ts');
      expect(() => service.readFile('project-1', '/src/temp.ts')).toThrow(
        NotFoundException,
      );
    });

    it('should emit file:deleted event via gateway', () => {
      service.createFile('project-1', '/src/temp.ts', 'temp');
      service.deleteFile('project-1', '/src/temp.ts');
      expect(mockFilesGateway.emitFileDeleted).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ path: '/src/temp.ts' }),
      );
    });

    it('should throw NotFoundException for non-existent file', () => {
      service.getProjectFS('project-1');
      expect(() => service.deleteFile('project-1', '/nope.ts')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('moveFile', () => {
    it('should move a file to a new location', () => {
      service.createFile('project-1', '/src/old.ts', 'content');
      const moved = service.moveFile('project-1', '/src/old.ts', '/src/new.ts');
      expect(moved.path).toBe('/src/new.ts');
    });

    it('should emit file:moved event via gateway', () => {
      service.createFile('project-1', '/a.ts', 'content');
      service.moveFile('project-1', '/a.ts', '/b.ts');
      expect(mockFilesGateway.emitFileMoved).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ from: '/a.ts', to: '/b.ts' }),
      );
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', () => {
      service.createFile('project-1', '/src/a.ts', 'a');
      service.createFile('project-1', '/src/b.ts', 'b');
      const listing = service.listDirectory('project-1', '/src');
      expect(listing).toHaveLength(2);
    });

    it('should list root directory', () => {
      service.createFile('project-1', '/index.ts', 'root');
      const listing = service.listDirectory('project-1', '/');
      expect(listing.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getTree', () => {
    it('should return file tree metadata', () => {
      service.createFile('project-1', '/src/index.ts', 'content');
      const tree = service.getTree('project-1');
      expect(tree.name).toBe('project-1');
      expect(tree.fileCount).toBe(1);
      expect(tree.rootPath).toBe('/');
    });
  });

  describe('scaffoldProject', () => {
    it('should scaffold a nextjs project', () => {
      const tree = service.scaffoldProject('project-1', 'nextjs', {
        name: 'my-app',
      });
      expect(tree.fileCount).toBeGreaterThan(0);
      expect(tree.name).toBe('project-1');
    });

    it('should scaffold a react project', () => {
      const tree = service.scaffoldProject('project-2', 'react', {
        name: 'react-app',
        language: 'typescript',
      });
      expect(tree.fileCount).toBeGreaterThan(0);
    });

    it('should scaffold an express project', () => {
      const tree = service.scaffoldProject('project-3', 'express', {
        name: 'api-server',
      });
      expect(tree.fileCount).toBeGreaterThan(0);
    });

    it('should scaffold a nestjs project', () => {
      const tree = service.scaffoldProject('project-4', 'nestjs', {
        name: 'nest-app',
      });
      expect(tree.fileCount).toBeGreaterThan(0);
    });
  });

  describe('persistence integration', () => {
    it('should call persistFile after createFile', () => {
      service.createFile('project-1', '/src/index.ts', 'const x = 1;', 'typescript');
      expect(mockFilePersistence.persistFile).toHaveBeenCalledWith(
        'project-1',
        '/src/index.ts',
        'const x = 1;',
        'typescript',
      );
    });

    it('should call persistFile after updateFile', () => {
      service.createFile('project-1', '/src/index.ts', 'old');
      jest.clearAllMocks();
      service.updateFile('project-1', '/src/index.ts', 'new content');
      expect(mockFilePersistence.persistFile).toHaveBeenCalledWith(
        'project-1',
        '/src/index.ts',
        'new content',
        'typescript',
      );
    });

    it('should call deletePersistedFile after deleteFile', () => {
      service.createFile('project-1', '/src/temp.ts', 'temp');
      jest.clearAllMocks();
      service.deleteFile('project-1', '/src/temp.ts');
      expect(mockFilePersistence.deletePersistedFile).toHaveBeenCalledWith(
        'project-1',
        '/src/temp.ts',
      );
    });
  });
});

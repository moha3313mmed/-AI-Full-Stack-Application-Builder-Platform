import { Test, TestingModule } from '@nestjs/testing';

import { FilesService } from '../files/files.service';

import { ValidationPipeline } from './validation-pipeline';

describe('ValidationPipeline', () => {
  let pipeline: ValidationPipeline;

  const mockFilesService = {
    readFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationPipeline,
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();

    pipeline = module.get<ValidationPipeline>(ValidationPipeline);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(pipeline).toBeDefined();
  });

  describe('validate', () => {
    it('should pass when all files are valid', () => {
      mockFilesService.readFile.mockImplementation((_projectId: string, path: string) => ({
        path,
        type: 'file',
        content: {
          text: 'export const hello = "world";',
          language: 'typescript',
        },
      }));

      const result = pipeline.validate('project-1', ['/src/index.ts']);

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.filesChecked).toBe(1);
    });

    it('should fail when a file is empty', () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/src/empty.ts',
        type: 'file',
        content: { text: '', language: 'typescript' },
      });

      const result = pipeline.validate('project-1', ['/src/empty.ts']);

      expect(result.passed).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('empty_file');
      expect(result.issues[0].severity).toBe('error');
    });

    it('should fail when a file has only whitespace', () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/src/blank.ts',
        type: 'file',
        content: { text: '   \n   \n   ', language: 'typescript' },
      });

      const result = pipeline.validate('project-1', ['/src/blank.ts']);

      expect(result.passed).toBe(false);
      expect(result.issues[0].type).toBe('empty_file');
    });

    it('should fail on invalid JSON files', () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/package.json',
        type: 'file',
        content: { text: '{ invalid json }}', language: 'json' },
      });

      const result = pipeline.validate('project-1', ['/package.json']);

      expect(result.passed).toBe(false);
      const jsonIssues = result.issues.filter((i) => i.type === 'invalid_json');
      expect(jsonIssues).toHaveLength(1);
      expect(jsonIssues[0].path).toBe('/package.json');
    });

    it('should pass on valid JSON files', () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/package.json',
        type: 'file',
        content: { text: '{"name": "test", "version": "1.0.0"}', language: 'json' },
      });

      const result = pipeline.validate('project-1', ['/package.json']);

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing relative imports', () => {
      mockFilesService.readFile.mockImplementation((_projectId: string, path: string) => {
        if (path === '/src/app.ts') {
          return {
            path: '/src/app.ts',
            type: 'file',
            content: {
              text: 'import { helper } from "./utils/helper";\nconsole.log(helper);',
              language: 'typescript',
            },
          };
        }
        throw new Error('File not found');
      });

      const result = pipeline.validate('project-1', ['/src/app.ts']);

      // Should have a warning about missing import
      const importIssues = result.issues.filter((i) => i.type === 'missing_import');
      expect(importIssues.length).toBeGreaterThan(0);
      expect(importIssues[0].severity).toBe('warning');
    });

    it('should not flag missing imports for files that exist', () => {
      mockFilesService.readFile.mockImplementation((_projectId: string, path: string) => {
        if (path === '/src/app.ts') {
          return {
            path: '/src/app.ts',
            type: 'file',
            content: {
              text: 'import { helper } from "./helper";\nconsole.log(helper);',
              language: 'typescript',
            },
          };
        }
        if (path === '/src/helper.ts') {
          return {
            path: '/src/helper.ts',
            type: 'file',
            content: { text: 'export const helper = 1;', language: 'typescript' },
          };
        }
        throw new Error('File not found');
      });

      const result = pipeline.validate('project-1', ['/src/app.ts']);

      const importIssues = result.issues.filter((i) => i.type === 'missing_import');
      expect(importIssues).toHaveLength(0);
    });

    it('should detect unbalanced braces as a warning', () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/src/broken.ts',
        type: 'file',
        content: {
          text: 'function foo() {\n  console.log("hello");\n',
          language: 'typescript',
        },
      });

      const result = pipeline.validate('project-1', ['/src/broken.ts']);

      // Unbalanced braces are a warning, not an error
      const syntaxIssues = result.issues.filter((i) => i.type === 'syntax_error');
      expect(syntaxIssues.length).toBeGreaterThan(0);
      expect(syntaxIssues[0].severity).toBe('warning');
      // Warnings don't cause failure
      expect(result.passed).toBe(true);
    });

    it('should handle file read errors gracefully', () => {
      mockFilesService.readFile.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = pipeline.validate('project-1', ['/src/missing.ts']);

      expect(result.passed).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('error');
      expect(result.filesChecked).toBe(1);
    });

    it('should check multiple files and aggregate results', () => {
      mockFilesService.readFile.mockImplementation((_projectId: string, path: string) => {
        if (path === '/src/good.ts') {
          return {
            path,
            type: 'file',
            content: { text: 'export const x = 1;', language: 'typescript' },
          };
        }
        if (path === '/src/empty.ts') {
          return {
            path,
            type: 'file',
            content: { text: '', language: 'typescript' },
          };
        }
        if (path === '/config.json') {
          return {
            path,
            type: 'file',
            content: { text: 'not json', language: 'json' },
          };
        }
        throw new Error('File not found');
      });

      const result = pipeline.validate('project-1', [
        '/src/good.ts',
        '/src/empty.ts',
        '/config.json',
      ]);

      expect(result.passed).toBe(false);
      expect(result.filesChecked).toBe(3);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    it('should not check syntax balance on non-code files', () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/README.md',
        type: 'file',
        content: {
          text: '# Hello (world\n\nSome text with unbalanced [brackets',
          language: 'markdown',
        },
      });

      const result = pipeline.validate('project-1', ['/README.md']);

      expect(result.passed).toBe(true);
      const syntaxIssues = result.issues.filter((i) => i.type === 'syntax_error');
      expect(syntaxIssues).toHaveLength(0);
    });

    it('should handle require() imports', () => {
      mockFilesService.readFile.mockImplementation((_projectId: string, path: string) => {
        if (path === '/src/index.js') {
          return {
            path: '/src/index.js',
            type: 'file',
            content: {
              text: 'const lib = require("./lib");\nmodule.exports = lib;',
              language: 'javascript',
            },
          };
        }
        throw new Error('File not found');
      });

      const result = pipeline.validate('project-1', ['/src/index.js']);

      const importIssues = result.issues.filter((i) => i.type === 'missing_import');
      expect(importIssues.length).toBeGreaterThan(0);
    });

    it('should not flag package imports (non-relative)', () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/src/app.ts',
        type: 'file',
        content: {
          text: 'import React from "react";\nimport { useState } from "react";\nconsole.log(React);',
          language: 'typescript',
        },
      });

      const result = pipeline.validate('project-1', ['/src/app.ts']);

      const importIssues = result.issues.filter((i) => i.type === 'missing_import');
      expect(importIssues).toHaveLength(0);
    });

    it('should return timestamp in result', () => {
      mockFilesService.readFile.mockReturnValue({
        path: '/src/app.ts',
        type: 'file',
        content: { text: 'const x = 1;', language: 'typescript' },
      });

      const before = Date.now();
      const result = pipeline.validate('project-1', ['/src/app.ts']);
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });
});

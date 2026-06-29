import { describe, it, expect } from 'vitest';

import { TemplateEngine } from '../codegen/template-engine.js';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  describe('Supported Frameworks', () => {
    it('should list all supported frameworks', () => {
      const frameworks = engine.getSupportedFrameworks();
      expect(frameworks).toContain('nextjs');
      expect(frameworks).toContain('react');
      expect(frameworks).toContain('express');
      expect(frameworks).toContain('nestjs');
    });
  });

  describe('Next.js Scaffolding', () => {
    it('should scaffold a Next.js TypeScript project', () => {
      const ops = engine.scaffoldProject({
        framework: 'nextjs',
        name: 'my-next-app',
        language: 'typescript',
      });

      expect(ops.length).toBeGreaterThan(0);

      const paths = ops.map((op) => op.path);
      expect(paths).toContain('/package.json');
      expect(paths).toContain('/tsconfig.json');
      expect(paths).toContain('/src/app/layout.tsx');
      expect(paths).toContain('/src/app/page.tsx');
      expect(paths).toContain('/src/app/globals.css');
    });

    it('should include correct dependencies in package.json', () => {
      const ops = engine.scaffoldProject({
        framework: 'nextjs',
        name: 'my-next-app',
      });

      const pkgOp = ops.find((op) => op.path === '/package.json');
      expect(pkgOp).toBeDefined();
      const pkg = JSON.parse(pkgOp!.content!);
      expect(pkg.dependencies.next).toBeDefined();
      expect(pkg.dependencies.react).toBeDefined();
    });

    it('should scaffold without tsconfig for JavaScript', () => {
      const ops = engine.scaffoldProject({
        framework: 'nextjs',
        name: 'my-next-app',
        language: 'javascript',
      });

      const paths = ops.map((op) => op.path);
      expect(paths).not.toContain('/tsconfig.json');
      expect(paths).toContain('/src/app/layout.jsx');
    });
  });

  describe('React Scaffolding', () => {
    it('should scaffold a React TypeScript project', () => {
      const ops = engine.scaffoldProject({
        framework: 'react',
        name: 'my-react-app',
        language: 'typescript',
      });

      const paths = ops.map((op) => op.path);
      expect(paths).toContain('/package.json');
      expect(paths).toContain('/tsconfig.json');
      expect(paths).toContain('/index.html');
      expect(paths).toContain('/src/main.tsx');
      expect(paths).toContain('/src/App.tsx');
      expect(paths).toContain('/src/index.css');
    });

    it('should include Vite as build tool', () => {
      const ops = engine.scaffoldProject({
        framework: 'react',
        name: 'my-react-app',
      });

      const pkgOp = ops.find((op) => op.path === '/package.json');
      const pkg = JSON.parse(pkgOp!.content!);
      expect(pkg.devDependencies.vite).toBeDefined();
      expect(pkg.scripts.dev).toBe('vite');
    });

    it('should scaffold JavaScript variant', () => {
      const ops = engine.scaffoldProject({
        framework: 'react',
        name: 'my-react-app',
        language: 'javascript',
      });

      const paths = ops.map((op) => op.path);
      expect(paths).not.toContain('/tsconfig.json');
      expect(paths).toContain('/src/main.jsx');
      expect(paths).toContain('/src/App.jsx');
    });
  });

  describe('Express Scaffolding', () => {
    it('should scaffold an Express TypeScript project', () => {
      const ops = engine.scaffoldProject({
        framework: 'express',
        name: 'my-api',
        language: 'typescript',
      });

      const paths = ops.map((op) => op.path);
      expect(paths).toContain('/package.json');
      expect(paths).toContain('/tsconfig.json');
      expect(paths).toContain('/src/index.ts');
    });

    it('should include express dependency', () => {
      const ops = engine.scaffoldProject({
        framework: 'express',
        name: 'my-api',
      });

      const pkgOp = ops.find((op) => op.path === '/package.json');
      const pkg = JSON.parse(pkgOp!.content!);
      expect(pkg.dependencies.express).toBeDefined();
    });
  });

  describe('NestJS Scaffolding', () => {
    it('should scaffold a NestJS project', () => {
      const ops = engine.scaffoldProject({
        framework: 'nestjs',
        name: 'my-nest-api',
      });

      const paths = ops.map((op) => op.path);
      expect(paths).toContain('/package.json');
      expect(paths).toContain('/tsconfig.json');
      expect(paths).toContain('/src/main.ts');
      expect(paths).toContain('/src/app.module.ts');
      expect(paths).toContain('/src/app.controller.ts');
      expect(paths).toContain('/src/app.service.ts');
    });

    it('should include NestJS dependencies', () => {
      const ops = engine.scaffoldProject({
        framework: 'nestjs',
        name: 'my-nest-api',
      });

      const pkgOp = ops.find((op) => op.path === '/package.json');
      const pkg = JSON.parse(pkgOp!.content!);
      expect(pkg.dependencies['@nestjs/core']).toBeDefined();
      expect(pkg.dependencies['@nestjs/common']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw for unsupported framework', () => {
      expect(() =>
        engine.scaffoldProject({
          framework: 'unsupported' as 'react',
          name: 'test',
        })
      ).toThrow('Unsupported framework');
    });
  });

  describe('All Operations Use Create Type', () => {
    it('should only produce create operations for scaffolding', () => {
      const ops = engine.scaffoldProject({
        framework: 'nextjs',
        name: 'test',
      });

      for (const op of ops) {
        expect(op.type).toBe('create');
      }
    });
  });
});

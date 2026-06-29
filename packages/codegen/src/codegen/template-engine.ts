import type { FileOperation } from '../vfs/types.js';

import type { ScaffoldConfig, Framework } from './types.js';

// ============================================================================
// Template Engine - Framework-specific project scaffolding
// ============================================================================

/**
 * Generates initial file trees for various frameworks.
 * Produces FileOperations that can be applied to a VFS.
 */
export class TemplateEngine {
  /**
   * Scaffold a new project with the specified framework and configuration.
   */
  scaffoldProject(config: ScaffoldConfig): FileOperation[] {
    const { framework, name, language = 'typescript' } = config;

    switch (framework) {
      case 'nextjs':
        return this.scaffoldNextJs(name, language, config);
      case 'react':
        return this.scaffoldReact(name, language, config);
      case 'express':
        return this.scaffoldExpress(name, language, config);
      case 'nestjs':
        return this.scaffoldNestJs(name, language, config);
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  /**
   * Get the list of supported frameworks.
   */
  getSupportedFrameworks(): Framework[] {
    return ['nextjs', 'react', 'express', 'nestjs'];
  }

  // ============================================================================
  // Framework Scaffolders
  // ============================================================================

  private scaffoldNextJs(
    name: string,
    language: string,
    _config: ScaffoldConfig
  ): FileOperation[] {
    const ext = language === 'typescript' ? 'tsx' : 'jsx';
    const configExt = language === 'typescript' ? 'ts' : 'js';
    const operations: FileOperation[] = [];

    // package.json
    operations.push({
      type: 'create',
      path: '/package.json',
      content: JSON.stringify(
        {
          name,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
          },
          dependencies: {
            next: '^14.0.0',
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            ...(language === 'typescript'
              ? {
                  typescript: '^5.0.0',
                  '@types/react': '^18.2.0',
                  '@types/node': '^20.0.0',
                }
              : {}),
            eslint: '^8.0.0',
            'eslint-config-next': '^14.0.0',
          },
        },
        null,
        2
      ),
      language: 'json',
    });

    // next.config
    operations.push({
      type: 'create',
      path: `/next.config.${configExt}`,
      content:
        language === 'typescript'
          ? `import type { NextConfig } from 'next';\n\nconst nextConfig: NextConfig = {\n  reactStrictMode: true,\n};\n\nexport default nextConfig;\n`
          : `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n};\n\nmodule.exports = nextConfig;\n`,
      language: language === 'typescript' ? 'typescript' : 'javascript',
    });

    // tsconfig.json (TypeScript only)
    if (language === 'typescript') {
      operations.push({
        type: 'create',
        path: '/tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2017',
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'bundler',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
              plugins: [{ name: 'next' }],
              paths: { '@/*': ['./src/*'] },
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules'],
          },
          null,
          2
        ),
        language: 'json',
      });
    }

    // App Router layout
    operations.push({
      type: 'create',
      path: `/src/app/layout.${ext}`,
      content: this.nextjsLayout(name, language),
      language: language === 'typescript' ? 'typescriptreact' : 'javascriptreact',
    });

    // App Router page
    operations.push({
      type: 'create',
      path: `/src/app/page.${ext}`,
      content: this.nextjsPage(name, language),
      language: language === 'typescript' ? 'typescriptreact' : 'javascriptreact',
    });

    // Global CSS
    operations.push({
      type: 'create',
      path: '/src/app/globals.css',
      content: `* {\n  box-sizing: border-box;\n  padding: 0;\n  margin: 0;\n}\n\nhtml,\nbody {\n  max-width: 100vw;\n  overflow-x: hidden;\n}\n`,
      language: 'css',
    });

    return operations;
  }

  private scaffoldReact(
    name: string,
    language: string,
    _config: ScaffoldConfig
  ): FileOperation[] {
    const ext = language === 'typescript' ? 'tsx' : 'jsx';
    const configExt = language === 'typescript' ? 'ts' : 'js';
    const operations: FileOperation[] = [];

    // package.json
    operations.push({
      type: 'create',
      path: '/package.json',
      content: JSON.stringify(
        {
          name,
          version: '0.1.0',
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            ...(language === 'typescript'
              ? {
                  typescript: '^5.0.0',
                  '@types/react': '^18.2.0',
                  '@types/react-dom': '^18.2.0',
                }
              : {}),
            vite: '^5.0.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        },
        null,
        2
      ),
      language: 'json',
    });

    // Vite config
    operations.push({
      type: 'create',
      path: `/vite.config.${configExt}`,
      content: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`,
      language: language === 'typescript' ? 'typescript' : 'javascript',
    });

    // tsconfig.json (TypeScript only)
    if (language === 'typescript') {
      operations.push({
        type: 'create',
        path: '/tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: 'react-jsx',
              strict: true,
            },
            include: ['src'],
          },
          null,
          2
        ),
        language: 'json',
      });
    }

    // index.html
    operations.push({
      type: 'create',
      path: '/index.html',
      content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.${ext}"></script>\n  </body>\n</html>\n`,
      language: 'html',
    });

    // Main entry
    operations.push({
      type: 'create',
      path: `/src/main.${ext}`,
      content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.${ext.replace('x', '')}';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
      language: language === 'typescript' ? 'typescriptreact' : 'javascriptreact',
    });

    // App component
    operations.push({
      type: 'create',
      path: `/src/App.${ext}`,
      content: `function App() {\n  return (\n    <div>\n      <h1>${name}</h1>\n      <p>Welcome to your new React application.</p>\n    </div>\n  );\n}\n\nexport default App;\n`,
      language: language === 'typescript' ? 'typescriptreact' : 'javascriptreact',
    });

    // CSS
    operations.push({
      type: 'create',
      path: '/src/index.css',
      content: `:root {\n  font-family: Inter, system-ui, sans-serif;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n}\n`,
      language: 'css',
    });

    return operations;
  }

  private scaffoldExpress(
    name: string,
    language: string,
    _config: ScaffoldConfig
  ): FileOperation[] {
    const ext = language === 'typescript' ? 'ts' : 'js';
    const operations: FileOperation[] = [];

    // package.json
    operations.push({
      type: 'create',
      path: '/package.json',
      content: JSON.stringify(
        {
          name,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: language === 'typescript' ? 'ts-node src/index.ts' : 'node src/index.js',
            build: language === 'typescript' ? 'tsc' : undefined,
            start: language === 'typescript' ? 'node dist/index.js' : 'node src/index.js',
          },
          dependencies: {
            express: '^4.18.0',
          },
          devDependencies: {
            ...(language === 'typescript'
              ? {
                  typescript: '^5.0.0',
                  '@types/express': '^4.17.0',
                  '@types/node': '^20.0.0',
                  'ts-node': '^10.9.0',
                }
              : {}),
          },
        },
        null,
        2
      ),
      language: 'json',
    });

    // tsconfig.json (TypeScript only)
    if (language === 'typescript') {
      operations.push({
        type: 'create',
        path: '/tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              lib: ['ES2020'],
              outDir: './dist',
              rootDir: './src',
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
            },
            include: ['src/**/*.ts'],
            exclude: ['node_modules', 'dist'],
          },
          null,
          2
        ),
        language: 'json',
      });
    }

    // Entry point
    operations.push({
      type: 'create',
      path: `/src/index.${ext}`,
      content:
        language === 'typescript'
          ? `import express, { Request, Response } from 'express';\n\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/', (_req: Request, res: Response) => {\n  res.json({ message: 'Hello from ${name}!' });\n});\n\napp.listen(port, () => {\n  console.log(\`Server running on port \${port}\`);\n});\n\nexport default app;\n`
          : `const express = require('express');\n\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Hello from ${name}!' });\n});\n\napp.listen(port, () => {\n  console.log(\`Server running on port \${port}\`);\n});\n\nmodule.exports = app;\n`,
      language: language === 'typescript' ? 'typescript' : 'javascript',
    });

    return operations;
  }

  private scaffoldNestJs(
    name: string,
    _language: string,
    _config: ScaffoldConfig
  ): FileOperation[] {
    const operations: FileOperation[] = [];

    // package.json
    operations.push({
      type: 'create',
      path: '/package.json',
      content: JSON.stringify(
        {
          name,
          version: '0.1.0',
          private: true,
          scripts: {
            build: 'nest build',
            start: 'nest start',
            'start:dev': 'nest start --watch',
            'start:prod': 'node dist/main',
          },
          dependencies: {
            '@nestjs/common': '^10.0.0',
            '@nestjs/core': '^10.0.0',
            '@nestjs/platform-express': '^10.0.0',
            'reflect-metadata': '^0.1.13',
            rxjs: '^7.8.0',
          },
          devDependencies: {
            '@nestjs/cli': '^10.0.0',
            '@types/node': '^20.0.0',
            typescript: '^5.0.0',
          },
        },
        null,
        2
      ),
      language: 'json',
    });

    // tsconfig.json
    operations.push({
      type: 'create',
      path: '/tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            module: 'commonjs',
            declaration: true,
            removeComments: true,
            emitDecoratorMetadata: true,
            experimentalDecorators: true,
            allowSyntheticDefaultImports: true,
            target: 'ES2021',
            sourceMap: true,
            outDir: './dist',
            rootDir: './src',
            strict: true,
            skipLibCheck: true,
          },
          include: ['src/**/*.ts'],
          exclude: ['node_modules', 'dist'],
        },
        null,
        2
      ),
      language: 'json',
    });

    // Main entry
    operations.push({
      type: 'create',
      path: '/src/main.ts',
      content: `import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\n\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  await app.listen(3000);\n}\n\nbootstrap();\n`,
      language: 'typescript',
    });

    // App module
    operations.push({
      type: 'create',
      path: '/src/app.module.ts',
      content: `import { Module } from '@nestjs/common';\nimport { AppController } from './app.controller';\nimport { AppService } from './app.service';\n\n@Module({\n  imports: [],\n  controllers: [AppController],\n  providers: [AppService],\n})\nexport class AppModule {}\n`,
      language: 'typescript',
    });

    // App controller
    operations.push({
      type: 'create',
      path: '/src/app.controller.ts',
      content: `import { Controller, Get } from '@nestjs/common';\nimport { AppService } from './app.service';\n\n@Controller()\nexport class AppController {\n  constructor(private readonly appService: AppService) {}\n\n  @Get()\n  getHello(): string {\n    return this.appService.getHello();\n  }\n}\n`,
      language: 'typescript',
    });

    // App service
    operations.push({
      type: 'create',
      path: '/src/app.service.ts',
      content: `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class AppService {\n  getHello(): string {\n    return 'Hello from ${name}!';\n  }\n}\n`,
      language: 'typescript',
    });

    return operations;
  }

  // ============================================================================
  // Template Helpers
  // ============================================================================

  private nextjsLayout(name: string, _language: string): string {
    return `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${name}',
  description: 'Generated by ${name}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
  }

  private nextjsPage(name: string, _language: string): string {
    return `export default function Home() {
  return (
    <main>
      <h1>${name}</h1>
      <p>Welcome to your new Next.js application.</p>
    </main>
  );
}
`;
  }
}

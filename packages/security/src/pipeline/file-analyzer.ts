import { ScanFile } from '../types/index.js';

/**
 * Supported file types for scanning.
 */
export type FileType = 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'sql' | 'unknown';

/**
 * Result of file analysis.
 */
export interface AnalyzedFile {
  path: string;
  content: string;
  fileType: FileType;
  lineCount: number;
  isBinary: boolean;
}

/**
 * Binary file signatures (magic bytes) for detection.
 */
const BINARY_INDICATORS = ['\x00', '\xFF\xD8', '\x89PNG', '\x7FELF'];

/**
 * FileAnalyzer preprocesses files for scanning - determines file type,
 * filters binary files, and provides analysis helpers.
 */
export class FileAnalyzer {
  private readonly extensionMap: Record<string, FileType> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.json': 'json',
    '.sql': 'sql',
  };

  /**
   * Analyze a set of files, filtering out binary files and determining types.
   */
  analyze(files: ScanFile[]): AnalyzedFile[] {
    return files
      .map((file) => this.analyzeFile(file))
      .filter((file) => !file.isBinary);
  }

  /**
   * Analyze a single file.
   */
  analyzeFile(file: ScanFile): AnalyzedFile {
    const isBinary = this.isBinaryContent(file.content);
    const fileType = this.determineFileType(file.path);
    const lineCount = isBinary ? 0 : file.content.split('\n').length;

    return {
      path: file.path,
      content: file.content,
      fileType,
      lineCount,
      isBinary,
    };
  }

  /**
   * Determine file type from extension.
   */
  determineFileType(filePath: string): FileType {
    const ext = this.getExtension(filePath);
    return this.extensionMap[ext] || 'unknown';
  }

  /**
   * Check if content appears to be binary.
   */
  isBinaryContent(content: string): boolean {
    for (const indicator of BINARY_INDICATORS) {
      if (content.startsWith(indicator)) {
        return true;
      }
    }

    // Check for null bytes in the first 1024 chars
    const sample = content.substring(0, 1024);
    return sample.includes('\x00');
  }

  /**
   * Get lines from file content for iteration.
   */
  getLines(content: string): string[] {
    return content.split('\n');
  }

  /**
   * Get the file extension including the dot.
   */
  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filePath.substring(lastDot).toLowerCase();
  }
}

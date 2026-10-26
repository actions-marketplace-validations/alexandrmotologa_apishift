import fs from 'node:fs';
import path from 'node:path';
import { AstWalker, ScanFileResult, ScannedCallSite } from './ast_walker.js';
import { MigrationRecipe } from '../spec/types.js';

export interface RepositoryScanSummary {
  repoPath: string;
  totalFilesScanned: number;
  affectedFilesCount: number;
  totalCallsitesCount: number;
  callsitesByType: Record<string, number>;
  fileResults: ScanFileResult[];
}

export class CallGraph {
  private static IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.turbo',
    '.cache',
  ]);

  private static VALID_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
  ]);

  public static scanRepository(repoPath: string, recipe: MigrationRecipe): RepositoryScanSummary {
    const absPath = path.resolve(repoPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Repository path does not exist: ${absPath}`);
    }

    const filesToScan: string[] = [];
    this.collectFiles(absPath, filesToScan);

    const fileResults: ScanFileResult[] = [];
    let totalCallsitesCount = 0;
    const callsitesByType: Record<string, number> = {};

    for (const filePath of filesToScan) {
      try {
        const source = fs.readFileSync(filePath, 'utf8');
        // Quick check to avoid deep AST parsing if file does not contain package name or key symbols
        if (this.quickFilter(source, recipe)) {
          const result = AstWalker.scanFile(filePath, source, recipe);
          if (result.callsites.length > 0) {
            fileResults.push(result);
            totalCallsitesCount += result.callsites.length;
            for (const cs of result.callsites) {
              callsitesByType[cs.transformationType] =
                (callsitesByType[cs.transformationType] || 0) + 1;
            }
          }
        }
      } catch (err) {
        // Skip files that fail to parse (e.g. malformed syntax)
      }
    }

    return {
      repoPath: absPath,
      totalFilesScanned: filesToScan.length,
      affectedFilesCount: fileResults.length,
      totalCallsitesCount,
      callsitesByType,
      fileResults,
    };
  }

  private static collectFiles(currentDir: string, accumulated: string[]): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!this.IGNORED_DIRS.has(entry.name)) {
          this.collectFiles(path.join(currentDir, entry.name), accumulated);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (this.VALID_EXTENSIONS.has(ext)) {
          accumulated.push(path.join(currentDir, entry.name));
        }
      }
    }
  }

  private static quickFilter(source: string, recipe: MigrationRecipe): boolean {
    // If the file mentions the package name, or any transformation source/target
    if (source.includes(recipe.packageName)) return true;

    for (const t of recipe.transformations) {
      if (t.type === 'METHOD_RENAME') {
        const parts = t.from.split('.');
        const lastPart = parts[parts.length - 1];
        if (source.includes(lastPart)) return true;
      } else if (t.type === 'CLASS_INSTANTIATION_RENAME') {
        if (source.includes(t.oldClass)) return true;
      } else if (t.type === 'IMPORT_RENAME') {
        if (source.includes(t.sourcePackage)) return true;
        for (const oi of t.oldImports) {
          if (source.includes(oi)) return true;
        }
      }
    }

    return false;
  }
}

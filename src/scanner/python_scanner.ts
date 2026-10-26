import fs from 'node:fs';
import path from 'node:path';
import { MigrationRecipe } from '../spec/types.js';

export interface PythonCallSite {
  id: string;
  filePath: string;
  line: number;
  callee: string;
  rawSnippet: string;
  transformationType: string;
}

export interface PythonFileResult {
  filePath: string;
  callsites: PythonCallSite[];
  hasPythonImports: boolean;
}

export interface PythonMutateResult {
  filePath: string;
  originalCode: string;
  modifiedCode: string;
  hasChanges: boolean;
  appliedCount: number;
}

export class PythonScanner {
  public static scanFile(filePath: string, source: string, recipe: MigrationRecipe): PythonFileResult {
    const lines = source.split('\n');
    const callsites: PythonCallSite[] = [];
    let hasPythonImports = false;

    // Check imports (e.g. import openai or from openai import ...)
    const importRegex = new RegExp(`^(?:import\\s+${recipe.packageName}|from\\s+${recipe.packageName}\\b)`, 'm');
    if (importRegex.test(source)) {
      hasPythonImports = true;
    }

    if (!hasPythonImports && !source.includes(recipe.packageName)) {
      return { filePath, callsites: [], hasPythonImports: false };
    }

    let counter = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check method rename transformations
      for (const t of recipe.transformations) {
        if (t.type === 'METHOD_RENAME') {
          const fromParts = t.from.split('.');
          const lastPart = fromParts[fromParts.length - 1]; // e.g. create or ChatCompletion.create
          const targetSuffix = fromParts.slice(-2).join('.');

          if (line.includes(t.from) || (targetSuffix && line.includes(targetSuffix))) {
            callsites.push({
              id: `py-call-${++counter}`,
              filePath,
              line: i + 1,
              callee: t.from,
              rawSnippet: line.trim(),
              transformationType: 'METHOD_RENAME',
            });
            break;
          }
        }
      }
    }

    return { filePath, callsites, hasPythonImports };
  }

  public static mutateFile(filePath: string, source: string, recipe: MigrationRecipe): PythonMutateResult {
    let modifiedCode = source;
    let appliedCount = 0;

    // 1. Method renames
    for (const t of recipe.transformations) {
      if (t.type === 'METHOD_RENAME') {
        const fromRegex = new RegExp(`\\b${t.from.replace(/\./g, '\\.')}\\b`, 'g');
        if (fromRegex.test(modifiedCode)) {
          modifiedCode = modifiedCode.replace(fromRegex, t.to);
          appliedCount++;
        }

        // Also check if imported without package prefix: e.g. ChatCompletion.create -> client.chat.completions.create
        const parts = t.from.split('.');
        if (parts.length >= 2) {
          const suffix = parts.slice(1).join('.');
          const toSuffix = t.to.split('.').slice(1).join('.');
          const suffixRegex = new RegExp(`\\b${suffix.replace(/\./g, '\\.')}\\b`, 'g');
          if (suffixRegex.test(modifiedCode) && !modifiedCode.includes(t.to)) {
            modifiedCode = modifiedCode.replace(suffixRegex, toSuffix);
            appliedCount++;
          }
        }
      }
    }

    // 2. Parameter renames (e.g. model_name="gpt-4" -> model="gpt-4")
    for (const t of recipe.transformations) {
      if (t.type === 'PARAM_RENAME') {
        for (const [oldParam, newParam] of Object.entries(t.paramMap)) {
          const paramRegex = new RegExp(`\\b${oldParam}\\s*=`, 'g');
          if (paramRegex.test(modifiedCode)) {
            modifiedCode = modifiedCode.replace(paramRegex, `${newParam}=`);
            appliedCount++;
          }
        }
      }
    }

    // 3. Response .data or dict indexing stripping
    for (const t of recipe.transformations) {
      if (t.type === 'RETURN_VALUE_ACCESS_TRANSFORM' && t.stripPropertyPrefix) {
        const propRegex = new RegExp(`\\.data\\.`, 'g');
        if (propRegex.test(modifiedCode)) {
          modifiedCode = modifiedCode.replace(propRegex, '.');
          appliedCount++;
        }
      }
    }

    return {
      filePath,
      originalCode: source,
      modifiedCode,
      hasChanges: source !== modifiedCode,
      appliedCount,
    };
  }

  public static scanRepository(repoPath: string, recipe: MigrationRecipe): PythonFileResult[] {
    const absPath = path.resolve(repoPath);
    const results: PythonFileResult[] = [];
    const pyFiles: string[] = [];

    const collect = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          if (!['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build'].includes(e.name)) {
            collect(path.join(dir, e.name));
          }
        } else if (e.isFile() && e.name.endsWith('.py')) {
          pyFiles.push(path.join(dir, e.name));
        }
      }
    };

    if (fs.existsSync(absPath)) {
      collect(absPath);
      for (const f of pyFiles) {
        const content = fs.readFileSync(f, 'utf8');
        const res = this.scanFile(f, content, recipe);
        if (res.callsites.length > 0) {
          results.push(res);
        }
      }
    }

    return results;
  }
}

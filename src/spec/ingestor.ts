import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { MigrationRecipe } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SpecIngestor {
  private static getBuiltinsDir(): string {
    const candidates = [
      path.resolve(__dirname, 'builtins'),
      path.resolve(__dirname, '../src/spec/builtins'),
      path.resolve(process.cwd(), 'src/spec/builtins'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    return candidates[0];
  }

  public static listBuiltinRecipes(): MigrationRecipe[] {
    const dir = this.getBuiltinsDir();
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));
    const recipes: MigrationRecipe[] = [];

    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const recipe = this.loadFile(fullPath);
        recipes.push(recipe);
      } catch {
        // Skip invalid files
      }
    }

    return recipes;
  }

  public static loadRecipe(identifierOrPath: string): MigrationRecipe {
    // 1. Check if direct file path exists
    if (fs.existsSync(identifierOrPath)) {
      return this.loadFile(identifierOrPath);
    }

    const dir = this.getBuiltinsDir();

    // 2. Check built-ins by ID
    const builtinJson = path.join(dir, `${identifierOrPath}.json`);
    if (fs.existsSync(builtinJson)) {
      return this.loadFile(builtinJson);
    }

    const builtinYaml = path.join(dir, `${identifierOrPath}.yaml`);
    if (fs.existsSync(builtinYaml)) {
      return this.loadFile(builtinYaml);
    }

    const builtinYml = path.join(dir, `${identifierOrPath}.yml`);
    if (fs.existsSync(builtinYml)) {
      return this.loadFile(builtinYml);
    }

    // Search by recipe id inside all builtins
    const all = this.listBuiltinRecipes();
    const matched = all.find(r => r.id === identifierOrPath || r.name.toLowerCase() === identifierOrPath.toLowerCase());
    if (matched) {
      return matched;
    }

    throw new Error(`Migration recipe not found for identifier or path: "${identifierOrPath}"`);
  }

  public static loadFile(filePath: string): MigrationRecipe {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    let parsed: unknown;

    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      parsed = yaml.parse(rawContent);
    } else {
      parsed = JSON.parse(rawContent);
    }

    return this.validate(parsed, filePath);
  }

  public static validate(data: unknown, sourceName: string = 'inline'): MigrationRecipe {
    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid migration recipe in ${sourceName}: Root must be an object.`);
    }

    const candidate = data as Partial<MigrationRecipe>;

    if (!candidate.id || typeof candidate.id !== 'string') {
      throw new Error(`Invalid recipe in ${sourceName}: Missing or non-string "id".`);
    }

    if (!candidate.packageName || typeof candidate.packageName !== 'string') {
      throw new Error(`Invalid recipe in ${sourceName}: Missing or non-string "packageName".`);
    }

    if (!Array.isArray(candidate.transformations)) {
      throw new Error(`Invalid recipe in ${sourceName}: "transformations" must be an array.`);
    }

    for (let i = 0; i < candidate.transformations.length; i++) {
      const t = candidate.transformations[i];
      if (!t || typeof t !== 'object' || !t.type) {
        throw new Error(`Invalid transformation rule at index ${i} in ${sourceName}: Missing "type".`);
      }
    }

    return {
      id: candidate.id,
      name: candidate.name || candidate.id,
      description: candidate.description || '',
      packageName: candidate.packageName,
      fromVersion: candidate.fromVersion || '0.0.0',
      toVersion: candidate.toVersion || '1.0.0',
      transformations: candidate.transformations,
    };
  }

  public static saveRecipe(filePath: string, recipe: MigrationRecipe): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      fs.writeFileSync(filePath, yaml.stringify(recipe), 'utf8');
    } else {
      fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2) + '\n', 'utf8');
    }
  }
}

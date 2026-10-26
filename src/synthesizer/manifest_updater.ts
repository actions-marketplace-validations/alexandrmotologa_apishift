import fs from 'node:fs';
import path from 'node:path';
import { MigrationRecipe } from '../spec/types.js';

export interface ManifestUpdateResult {
  updated: boolean;
  manifestType: 'package.json' | 'requirements.txt' | 'pyproject.toml' | 'none';
  manifestPath?: string;
  oldVersion?: string;
  newVersion?: string;
}

export class ManifestUpdater {
  public static updateProjectManifest(repoPath: string, recipe: MigrationRecipe): ManifestUpdateResult {
    const absRepo = path.resolve(repoPath);

    // 1. Check package.json (Node.js / JS / TS)
    const pkgJsonPath = path.join(absRepo, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const raw = fs.readFileSync(pkgJsonPath, 'utf8');
      try {
        const pkg = JSON.parse(raw);
        let updated = false;
        let oldVersion: string | undefined;
        const targetVersion = `^${recipe.toVersion}`;

        const sections = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
        for (const section of sections) {
          if (pkg[section] && pkg[section][recipe.packageName]) {
            oldVersion = pkg[section][recipe.packageName];
            pkg[section][recipe.packageName] = targetVersion;
            updated = true;
          }
        }

        if (updated) {
          // Detect indentation
          const indent = raw.match(/^[ \t]+/m)?.[0] || '  ';
          fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, indent) + '\n', 'utf8');
          return {
            updated: true,
            manifestType: 'package.json',
            manifestPath: pkgJsonPath,
            oldVersion,
            newVersion: targetVersion,
          };
        }
      } catch {
        // ignore parse error
      }
    }

    // 2. Check requirements.txt (Python)
    const reqPath = path.join(absRepo, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      const content = fs.readFileSync(reqPath, 'utf8');
      const lines = content.split('\n');
      let updated = false;
      let oldVersion: string | undefined;

      const newLines = lines.map((line) => {
        const trimmed = line.trim();
        const pkgRegex = new RegExp(`^${recipe.packageName}([=<>~!]+.*)?$`, 'i');
        if (pkgRegex.test(trimmed)) {
          updated = true;
          oldVersion = trimmed;
          return `${recipe.packageName}>=${recipe.toVersion}`;
        }
        return line;
      });

      if (updated) {
        fs.writeFileSync(reqPath, newLines.join('\n'), 'utf8');
        return {
          updated: true,
          manifestType: 'requirements.txt',
          manifestPath: reqPath,
          oldVersion,
          newVersion: `>=${recipe.toVersion}`,
        };
      }
    }

    // 3. Check pyproject.toml
    const pyprojectPath = path.join(absRepo, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
      const content = fs.readFileSync(pyprojectPath, 'utf8');
      const pattern = new RegExp(`("${recipe.packageName}|'${recipe.packageName})([=<>~^][^"']*)?`, 'g');
      if (pattern.test(content)) {
        const replaced = content.replace(pattern, `$1>=${recipe.toVersion}`);
        fs.writeFileSync(pyprojectPath, replaced, 'utf8');
        return {
          updated: true,
          manifestType: 'pyproject.toml',
          manifestPath: pyprojectPath,
          oldVersion: 'legacy',
          newVersion: `>=${recipe.toVersion}`,
        };
      }
    }

    return {
      updated: false,
      manifestType: 'none',
    };
  }
}

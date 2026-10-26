import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ManifestUpdater } from '../src/synthesizer/manifest_updater.js';
import { SpecIngestor } from '../src/spec/ingestor.js';

describe('ManifestUpdater', () => {
  it('should update package.json dependency version to target recipe version', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apishift-pkg-'));
    const pkgPath = path.join(tempDir, 'package.json');
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({
        name: 'test-app',
        dependencies: {
          openai: '^0.28.0',
        },
      }, null, 2),
      'utf8'
    );

    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');
    const res = ManifestUpdater.updateProjectManifest(tempDir, recipe);

    expect(res.updated).toBe(true);
    expect(res.manifestType).toBe('package.json');
    expect(res.oldVersion).toBe('^0.28.0');
    expect(res.newVersion).toBe('^1.0.0');

    const updatedPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(updatedPkg.dependencies.openai).toBe('^1.0.0');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should update Python requirements.txt package version', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apishift-py-'));
    const reqPath = path.join(tempDir, 'requirements.txt');
    fs.writeFileSync(reqPath, 'openai==0.28.0\nrequests>=2.0.0\n', 'utf8');

    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');
    const res = ManifestUpdater.updateProjectManifest(tempDir, recipe);

    expect(res.updated).toBe(true);
    expect(res.manifestType).toBe('requirements.txt');

    const updatedContent = fs.readFileSync(reqPath, 'utf8');
    expect(updatedContent).toContain('openai>=1.0.0');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

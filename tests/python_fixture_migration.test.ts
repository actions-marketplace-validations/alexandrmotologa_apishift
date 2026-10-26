import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { MigrationAgent } from '../src/agent/loop.js';
import { SpecIngestor } from '../src/spec/ingestor.js';

describe('Python Fixture Migration', () => {
  let tempRepoDir: string;

  beforeEach(() => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apishift-py-fixture-'));
    const fixtureDir = path.resolve(__dirname, '../fixtures/sample_python_project');

    // Recursive copy fixture to temp directory
    fs.cpSync(fixtureDir, tempRepoDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempRepoDir)) {
      fs.rmSync(tempRepoDir, { recursive: true, force: true });
    }
  });

  it('should scan, mutate Python callsites, upgrade requirements.txt, and pass python test suite', async () => {
    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');

    // Run migration agent using python unittest runner
    const result = await MigrationAgent.run({
      repoPath: tempRepoDir,
      recipe,
      sandboxMode: 'local',
      testCommand: 'python test_ai_client.py',
      maxIterations: 3,
      autoUpgradeManifest: true,
      generateReport: true,
    });

    expect(result.success).toBe(true);
    expect(result.mutatedFiles.length).toBeGreaterThan(0);

    // Verify requirements.txt upgraded
    const reqContent = fs.readFileSync(path.join(tempRepoDir, 'requirements.txt'), 'utf8');
    expect(reqContent).toContain('openai>=1.0.0');

    // Verify Python source mutated
    const pySource = fs.readFileSync(path.join(tempRepoDir, 'src/ai_client.py'), 'utf8');
    expect(pySource).not.toContain('openai.ChatCompletion.create');
    expect(pySource).toContain('openai.chat.completions.create');

    // Verify report generated
    expect(result.reportPath).toBeDefined();
    if (result.reportPath) {
      expect(fs.existsSync(result.reportPath)).toBe(true);
    }
  });
});

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { MigrationAgent } from '../src/agent/loop.js';
import { SpecIngestor } from '../src/spec/ingestor.js';

describe('MigrationAgent Healing Loop', () => {
  it('should scan, transform, and verify test suite on a sample repository', async () => {
    // Create temporary workspace
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apishift-test-'));
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Copy fixture files
    const fixtureRoot = path.resolve('fixtures/sample_openai_project');
    fs.cpSync(path.join(fixtureRoot, 'package.json'), path.join(tempDir, 'package.json'));
    fs.cpSync(path.join(fixtureRoot, 'test.js'), path.join(tempDir, 'test.js'));
    if (fs.existsSync(path.join(fixtureRoot, 'stubs'))) {
      fs.cpSync(path.join(fixtureRoot, 'stubs'), path.join(tempDir, 'stubs'), { recursive: true });
    }
    if (fs.existsSync(path.join(fixtureRoot, 'node_modules'))) {
      fs.cpSync(path.join(fixtureRoot, 'node_modules'), path.join(tempDir, 'node_modules'), { recursive: true });
    }

    // Write unmigrated source code
    const initialSource = `
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({ apiKey: 'test' });
const openai = new OpenAIApi(configuration);

async function generateSummary(prompt) {
  const response = await openai.createChatCompletion({
    model_name: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }]
  });
  return response.data.choices[0].message.content;
}

module.exports = { openai, generateSummary };
`;
    fs.writeFileSync(path.join(srcDir, 'ai_service.js'), initialSource, 'utf8');

    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');

    const result = await MigrationAgent.run({
      repoPath: tempDir,
      recipe,
      testCommand: 'node --test test.js',
      sandboxMode: 'local',
      maxIterations: 3,
    });

    expect(result.success).toBe(true);
    expect(result.initialScan.totalCallsitesCount).toBeGreaterThan(0);
    expect(result.mutatedFiles.length).toBe(1);
    expect(result.finalTestResult?.passed).toBe(true);

    // Verify modified code on disk
    const modifiedCode = fs.readFileSync(path.join(srcDir, 'ai_service.js'), 'utf8');
    expect(modifiedCode).toContain('OpenAI');
    expect(modifiedCode).toContain('chat.completions.create');
    expect(modifiedCode).toContain('response.choices');

    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });
});

import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../src/git/report_generator.js';
import { SpecIngestor } from '../src/spec/ingestor.js';

describe('ReportGenerator', () => {
  it('should generate markdown and html reports with correct summary metrics', () => {
    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');
    const mockResult: any = {
      success: true,
      totalIterations: 1,
      patchSummary: {
        totalFilesChanged: 2,
        totalAdditions: 15,
        totalDeletions: 12,
        files: [
          { filePath: '/app/ai.ts', additions: 10, deletions: 8, appliedCount: 3 },
          { filePath: '/app/test.ts', additions: 5, deletions: 4, appliedCount: 1 },
        ],
      },
      healingLog: ['All tests passed on green.'],
      finalTestResult: {
        modeUsed: 'docker',
        durationMs: 350,
        exitCode: 0,
        stdout: 'All 12 tests passed.',
      },
    };

    const md = ReportGenerator.generateMarkdown({ repoPath: '/app', recipe, result: mockResult });
    expect(md).toContain('# APIShift Migration & Verification Report');
    expect(md).toContain('100% Tests Green');
    expect(md).toContain('openai');
    expect(md).toContain('+15 / -12');

    const html = ReportGenerator.generateHtml({ repoPath: '/app', recipe, result: mockResult });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('100% Tests Passing');
    expect(html).toContain('ai.ts');
  });
});

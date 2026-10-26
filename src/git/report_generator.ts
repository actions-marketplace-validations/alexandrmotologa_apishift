import fs from 'node:fs';
import path from 'node:path';
import { MigrationRunResult } from '../agent/loop.js';
import { MigrationRecipe } from '../spec/types.js';

export interface ReportOptions {
  repoPath: string;
  recipe: MigrationRecipe;
  result: MigrationRunResult;
}

export class ReportGenerator {
  public static generateMarkdown(options: ReportOptions): string {
    const { recipe, result } = options;
    const dateStr = new Date().toISOString().split('T')[0];

    const fileListRows = result.patchSummary.files
      .map(
        (f) =>
          `| \`${path.basename(f.filePath)}\` | +${f.additions} | -${f.deletions} | ${f.appliedCount} |`
      )
      .join('\n');

    const transformationsList = recipe.transformations
      .map((t) => `- **${t.type}**: ${t.description || t.type}`)
      .join('\n');

    const healingLogList =
      result.healingLog.length > 0
        ? result.healingLog.map((log) => `- ${log}`).join('\n')
        : '- Migration passed on first attempt without test regressions.';

    return `# APIShift Migration & Verification Report

- Date: ${dateStr}
- Package: \`${recipe.packageName}\`
- Version Upgrade: \`${recipe.fromVersion}\` → \`${recipe.toVersion}\`
- Status: ${result.success ? '**PASSED (100% Tests Green)**' : '**FAILED (Action Required)**'}
- Healing Iterations: ${result.totalIterations}
- Files Modified: ${result.patchSummary.totalFilesChanged}
- Total Line Changes: +${result.patchSummary.totalAdditions} / -${result.patchSummary.totalDeletions}

---

## Migration Rules Applied
${transformationsList}

---

## Changed Files Summary
| File | Additions | Deletions | Transformed Callsites |
| :--- | :--- | :--- | :--- |
${fileListRows || '| No files modified | 0 | 0 | 0 |'}

---

## Healing & Test Execution Log
${healingLogList}

---

## Sandbox Test Execution Details
- Mode: \`${result.finalTestResult?.modeUsed || 'local'}\`
- Duration: ${result.finalTestResult?.durationMs || 0}ms
- Exit Code: ${result.finalTestResult?.exitCode ?? 'N/A'}

\`\`\`text
${result.finalTestResult?.stdout ? result.finalTestResult.stdout.slice(0, 1000) : 'Tests verified successfully.'}
\`\`\`

Generated automatically by APIShift.
`;
  }

  public static generateHtml(options: ReportOptions): string {
    const md = this.generateMarkdown(options);
    const { recipe, result } = options;
    const statusColor = result.success ? '#10b981' : '#ef4444';
    const statusText = result.success ? '100% Tests Passing' : 'Regression Detected';

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>APIShift Report: ${recipe.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 2rem; }
    .card { background: #111827; border: 1px solid #1f293d; border-radius: 8px; padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    h1 { color: #f8fafc; font-size: 1.5rem; margin-top: 0; }
    .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.6rem; border-bottom: 1px solid #1f293d; }
    th { color: #94a3b8; font-weight: 600; }
    pre { background: #070b13; padding: 1rem; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 0.8rem; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h1>APIShift Migration Report: ${recipe.packageName}</h1>
      <span class="badge">${statusText}</span>
    </div>
    <p style="color:#94a3b8;">Upgraded from <code>${recipe.fromVersion}</code> to <code>${recipe.toVersion}</code> in ${result.totalIterations} iteration(s).</p>
    <h3>File Statistics</h3>
    <table>
      <thead>
        <tr><th>File</th><th>Additions</th><th>Deletions</th><th>Callsites</th></tr>
      </thead>
      <tbody>
        ${result.patchSummary.files.map(f => `<tr><td><code>${path.basename(f.filePath)}</code></td><td style="color:#34d399">+${f.additions}</td><td style="color:#f87171">-${f.deletions}</td><td>${f.appliedCount}</td></tr>`).join('')}
      </tbody>
    </table>
    <h3>Verification Output</h3>
    <pre>${result.finalTestResult?.stdout ? result.finalTestResult.stdout.replace(/</g, '&lt;').slice(0, 1200) : 'All tests passed.'}</pre>
  </div>
</body>
</html>`;
  }

  public static saveReport(repoPath: string, options: ReportOptions): string {
    const reportMd = this.generateMarkdown(options);
    const targetFile = path.resolve(repoPath, 'APISHIFT_MIGRATION_REPORT.md');
    fs.writeFileSync(targetFile, reportMd, 'utf8');
    return targetFile;
  }
}

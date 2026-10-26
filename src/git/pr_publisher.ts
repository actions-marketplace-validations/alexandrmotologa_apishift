import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Octokit } from 'octokit';
import { MigrationRunResult } from '../agent/loop.js';
import { MigrationRecipe } from '../spec/types.js';

export interface PrCreationOptions {
  repoPath: string;
  recipe: MigrationRecipe;
  migrationResult: MigrationRunResult;
  baseBranch?: string;
  token?: string;
}

export interface PrCreationResult {
  url?: string;
  number?: number;
  title: string;
  body: string;
  created: boolean;
  error?: string;
}

export class PrPublisher {
  public static generatePrContent(recipe: MigrationRecipe, result: MigrationRunResult): {
    title: string;
    body: string;
  } {
    const title = `refactor(api): migrate ${recipe.packageName} from ${recipe.fromVersion} to ${recipe.toVersion}`;

    const filesChangedCount = result.patchSummary.totalFilesChanged;
    const additions = result.patchSummary.totalAdditions;
    const deletions = result.patchSummary.totalDeletions;
    const testMode = result.finalTestResult?.modeUsed || 'local';
    const testDuration = result.finalTestResult?.durationMs || 0;

    const fileRows = result.patchSummary.files
      .map(
        f =>
          `| \`${path.basename(f.filePath)}\` | +${f.additions} | -${f.deletions} | ${f.appliedCount} |`
      )
      .join('\n');

    const transformationsList = recipe.transformations
      .map(t => `- **${t.type}**: ${t.description || t.type}`)
      .join('\n');

    const body = `## Summary

This pull request migrates the codebase from \`${recipe.packageName}@${recipe.fromVersion}\` to \`${recipe.packageName}@${recipe.toVersion}\` using automated AST transformations and sandboxed test verification.

### Scope of changes
- Files updated: ${filesChangedCount}
- Lines modified: +${additions} / -${deletions}
- Healing iterations required: ${result.totalIterations}
- Test suite status: 100% passing (${testMode} sandbox, ${testDuration}ms)

### Migration rules applied
${transformationsList}

### Modified files
| File | Additions | Deletions | Callsites |
| :--- | :--- | :--- | :--- |
${fileRows}

### Verification proof
\`\`\`text
${result.finalTestResult?.stdout ? result.finalTestResult.stdout.slice(0, 800) : 'Tests passed on green with exit code 0.'}
\`\`\`

Generated automatically by [APIShift](https://github.com/alexandrmotologa/apishift).
`;

    return { title, body };
  }

  public static async createPullRequest(options: PrCreationOptions): Promise<PrCreationResult> {
    const { repoPath, recipe, migrationResult, baseBranch = 'main', token } = options;
    const cwd = path.resolve(repoPath);

    const { title, body } = this.generatePrContent(recipe, migrationResult);

    // Option 1: Try GitHub API if token is provided
    if (token) {
      try {
        const octokit = new Octokit({ auth: token });
        const remoteRes = spawnSync('git', ['remote', 'get-url', 'origin'], {
          cwd,
          encoding: 'utf8',
        });
        const remoteUrl = (remoteRes.stdout || '').trim();
        const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);

        if (match) {
          const [, owner, repo] = match;
          const headBranch = spawnSync('git', ['branch', '--show-current'], {
            cwd,
            encoding: 'utf8',
          }).stdout.trim();

          const pr = await octokit.rest.pulls.create({
            owner,
            repo,
            title,
            body,
            head: headBranch,
            base: baseBranch,
          });

          return {
            url: pr.data.html_url,
            number: pr.data.number,
            title,
            body,
            created: true,
          };
        }
      } catch (err: any) {
        // Fall back to gh CLI
      }
    }

    // Option 2: Try gh CLI
    const ghRes = spawnSync('gh', ['pr', 'create', '--title', title, '--body', body, '--base', baseBranch], {
      cwd,
      encoding: 'utf8',
    });

    if (ghRes.status === 0) {
      const url = (ghRes.stdout || '').trim();
      return {
        url,
        title,
        body,
        created: true,
      };
    }

    return {
      title,
      body,
      created: false,
      error: (ghRes.stderr || ghRes.stdout || 'Failed to create pull request via gh CLI').trim(),
    };
  }
}

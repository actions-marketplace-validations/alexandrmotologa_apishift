import { spawnSync } from 'node:child_process';
import path from 'node:path';

export interface GitBranchResult {
  branchName: string;
  commitHash: string;
  filesCommitted: string[];
}

export class BranchManager {
  public static isGitRepository(repoPath: string): boolean {
    const res = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: path.resolve(repoPath),
      encoding: 'utf8',
    });
    return res.status === 0;
  }

  public static getCurrentBranch(repoPath: string): string {
    const res = spawnSync('git', ['branch', '--show-current'], {
      cwd: path.resolve(repoPath),
      encoding: 'utf8',
    });
    return (res.stdout || '').trim() || 'main';
  }

  public static createMigrationBranch(
    repoPath: string,
    packageName: string,
    targetVersion: string
  ): string {
    const safePkg = packageName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const safeVer = targetVersion.replace(/[^a-zA-Z0-9._-]/g, '-');
    const branchName = `apishift/migrate-${safePkg}-${safeVer}`;

    const cwd = path.resolve(repoPath);

    // Check if branch exists
    const checkRes = spawnSync('git', ['rev-parse', '--verify', branchName], {
      cwd,
      encoding: 'utf8',
    });

    if (checkRes.status === 0) {
      // Checkout existing
      spawnSync('git', ['checkout', branchName], { cwd, encoding: 'utf8' });
    } else {
      // Create new branch
      spawnSync('git', ['checkout', '-b', branchName], { cwd, encoding: 'utf8' });
    }

    return branchName;
  }

  public static commitChanges(
    repoPath: string,
    files: string[],
    message: string
  ): GitBranchResult {
    const cwd = path.resolve(repoPath);

    for (const f of files) {
      spawnSync('git', ['add', path.resolve(f)], { cwd, encoding: 'utf8' });
    }

    const commitRes = spawnSync('git', ['commit', '-m', message], {
      cwd,
      encoding: 'utf8',
    });

    const revRes = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
    });

    const branchName = this.getCurrentBranch(repoPath);
    const commitHash = (revRes.stdout || '').trim();

    return {
      branchName,
      commitHash,
      filesCommitted: files,
    };
  }

  public static pushBranch(repoPath: string, branchName: string): boolean {
    const res = spawnSync('git', ['push', '-u', 'origin', branchName], {
      cwd: path.resolve(repoPath),
      encoding: 'utf8',
    });
    return res.status === 0;
  }
}

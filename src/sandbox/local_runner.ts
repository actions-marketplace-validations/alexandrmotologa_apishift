import { spawn } from 'node:child_process';
import path from 'node:path';
import { TestExecutionOptions, TestExecutionResult } from './types.js';

export class LocalRunner {
  public static async runTest(options: TestExecutionOptions): Promise<TestExecutionResult> {
    const startTime = Date.now();
    const command = options.command || 'npm test';
    const timeoutMs = options.timeoutMs || 60000;
    const absCwd = path.resolve(options.cwd);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let isSettled = false;

      // Detect shell for Windows / Unix
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWin ? ['/d', '/s', '/c', command] : ['-c', command];

      const child = spawn(shell, shellArgs, {
        cwd: absCwd,
        env: {
          ...process.env,
          ...(options.env || {}),
          CI: 'true',
          FORCE_COLOR: '0',
        },
        windowsVerbatimArguments: isWin,
      });

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            if (isWin) {
              spawn('taskkill', ['/pid', child.pid!.toString(), '/f', '/t']);
            } else {
              child.kill('SIGKILL');
            }
          } catch {
            // ignore kill error
          }
          const durationMs = Date.now() - startTime;
          resolve({
            exitCode: 124,
            stdout,
            stderr: stderr + `\nExecution timed out after ${timeoutMs}ms`,
            durationMs,
            passed: false,
            modeUsed: 'local',
          });
        }
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString('utf8');
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString('utf8');
      });

      child.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          const durationMs = Date.now() - startTime;
          resolve({
            exitCode: 1,
            stdout,
            stderr: stderr + `\nProcess spawn error: ${err.message}`,
            durationMs,
            passed: false,
            modeUsed: 'local',
          });
        }
      });

      child.on('close', (code) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          const exitCode = code === null ? 1 : code;
          const durationMs = Date.now() - startTime;
          resolve({
            exitCode,
            stdout,
            stderr,
            durationMs,
            passed: exitCode === 0,
            modeUsed: 'local',
          });
        }
      });
    });
  }
}

import Docker from 'dockerode';
import path from 'node:path';
import { TestExecutionOptions, TestExecutionResult } from './types.js';

export class DockerRunner {
  private docker: Docker;

  constructor() {
    // On Windows, Docker Desktop uses named pipe //./pipe/docker_engine
    // On Linux/Mac, uses /var/run/docker.sock
    if (process.platform === 'win32') {
      this.docker = new Docker({ socketPath: '//./pipe/docker_engine' });
    } else {
      this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    }
  }

  public async isAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  public async runTest(options: TestExecutionOptions): Promise<TestExecutionResult> {
    const startTime = Date.now();
    const command = options.command || 'npm test';
    const timeoutMs = options.timeoutMs || 60000;
    const absCwd = path.resolve(options.cwd);

    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      throw new Error('Docker daemon is not available or not running on this host.');
    }

    // Convert Windows path for Docker volume mounting if necessary
    const hostMount = absCwd.replace(/\\/g, '/');
    const containerWorkDir = '/app';

    let container: Docker.Container | null = null;
    let stdout = '';
    let stderr = '';
    let exitCode = 1;

    try {
      container = await this.docker.createContainer({
        Image: 'node:22-alpine',
        Cmd: ['sh', '-c', command],
        WorkingDir: containerWorkDir,
        HostConfig: {
          Binds: [`${hostMount}:${containerWorkDir}`],
          AutoRemove: false,
        },
        Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : [],
      });

      const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
      });

      container.modem.demuxStream(
        stream,
        { write: (chunk: Buffer) => { stdout += chunk.toString('utf8'); } } as any,
        { write: (chunk: Buffer) => { stderr += chunk.toString('utf8'); } } as any
      );

      await container.start();

      // Wait with timeout
      const waitPromise = container.wait();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Test execution timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const waitResult = await Promise.race([waitPromise, timeoutPromise]);
      exitCode = (waitResult as any).StatusCode || 0;
    } catch (err: any) {
      stderr += `\nDocker execution error: ${err.message}`;
      exitCode = 1;
    } finally {
      if (container) {
        try {
          await container.remove({ force: true });
        } catch {
          // ignore cleanup errors
        }
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      exitCode,
      stdout,
      stderr,
      durationMs,
      passed: exitCode === 0,
      modeUsed: 'docker',
    };
  }
}

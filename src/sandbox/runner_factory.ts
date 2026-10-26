import { DockerRunner } from './docker_runner.js';
import { LocalRunner } from './local_runner.js';
import { TestExecutionOptions, TestExecutionResult, SandboxMode } from './types.js';

export class RunnerFactory {
  private static dockerRunnerInstance: DockerRunner | null = null;

  public static getDockerRunner(): DockerRunner {
    if (!this.dockerRunnerInstance) {
      this.dockerRunnerInstance = new DockerRunner();
    }
    return this.dockerRunnerInstance;
  }

  public static async execute(options: TestExecutionOptions): Promise<TestExecutionResult> {
    const mode: SandboxMode = options.sandboxMode || 'auto';

    if (mode === 'docker') {
      const docker = this.getDockerRunner();
      const available = await docker.isAvailable();
      if (!available) {
        throw new Error(
          'Docker sandbox was explicitly requested, but Docker daemon is not running or accessible.'
        );
      }
      return docker.runTest(options);
    }

    if (mode === 'local') {
      return LocalRunner.runTest(options);
    }

    // Auto mode: try Docker, fall back to Local
    const docker = this.getDockerRunner();
    const dockerAvailable = await docker.isAvailable();
    if (dockerAvailable) {
      try {
        return await docker.runTest(options);
      } catch {
        // Fall back to local runner if docker container initialization fails
        return LocalRunner.runTest(options);
      }
    }

    return LocalRunner.runTest(options);
  }
}

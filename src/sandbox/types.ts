export type SandboxMode = 'docker' | 'local' | 'auto';

export interface TestExecutionOptions {
  cwd: string;
  command?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  sandboxMode?: SandboxMode;
}

export interface TestExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
  modeUsed: 'docker' | 'local';
}

export type ErrorClassification =
  | 'COMPILER_ERROR'
  | 'ASSERTION_FAILURE'
  | 'RUNTIME_ERROR'
  | 'MISSING_PROPERTY'
  | 'TYPE_MISMATCH'
  | 'UNKNOWN';

export interface ParsedError {
  classification: ErrorClassification;
  message: string;
  rawLine: string;
  filePath?: string;
  line?: number;
  column?: number;
  symbolName?: string;
  failedTestName?: string;
  expected?: string;
  actual?: string;
}

export interface ErrorReport {
  rawOutput: string;
  errors: ParsedError[];
  totalFailures: number;
  failedTestNames: string[];
}

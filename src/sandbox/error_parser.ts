import { ErrorReport, ParsedError, ErrorClassification } from './types.js';

export class ErrorParser {
  public static parse(output: string): ErrorReport {
    const lines = output.split('\n');
    const errors: ParsedError[] = [];
    const failedTestNames: string[] = [];

    // Regex patterns
    // 1. TS Error: file.ts:line:col - error TSxxxx: message
    const tsErrorRegex = /([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)[:(](\d+)[:,\s](\d+)\)?\s*-\s*error\s*(TS\d+):\s*(.*)/i;
    // 2. Vitest / Jest fail symbol: ✕ test name or × test name
    const testFailRegex = /[✕×✖]\s+(.+?)(?:\s+\(\d+m?s\))?$/;
    // 3. TypeError / ReferenceError / AssertionError
    const runtimeErrorRegex = /((?:Type|Reference|Assertion|Syntax|Range)Error(?::|\s\[ERR_[^\]]+\]:?))\s*(.*)/;
    // 4. Stack line: at something (path:line:col) or at path:line:col
    const stackRegex = /at\s+(?:(.+?)\s+\()?([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+):(\d+):(\d+)\)?/;
    // 5. Expected / Received
    const expectedRegex = /Expected:\s*(.*)/;
    const receivedRegex = /Received:\s*(.*)/;

    let currentError: Partial<ParsedError> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check test failure line
      const testMatch = line.match(testFailRegex);
      if (testMatch) {
        failedTestNames.push(testMatch[1].trim());
      }

      // Check TypeScript error
      const tsMatch = line.match(tsErrorRegex);
      if (tsMatch) {
        const [, filePath, lineStr, colStr, tsCode, message] = tsMatch;
        let classification: ErrorClassification = 'COMPILER_ERROR';

        let symbolName: string | undefined;
        if (tsCode === 'TS2339') {
          // Property 'X' does not exist on type 'Y'
          classification = 'MISSING_PROPERTY';
          const propMatch = message.match(/Property '([^']+)' does not exist/);
          if (propMatch) {
            symbolName = propMatch[1];
          }
        } else if (tsCode === 'TS2345' || tsCode === 'TS2554') {
          classification = 'TYPE_MISMATCH';
        }

        errors.push({
          classification,
          message: `${tsCode}: ${message.trim()}`,
          rawLine: line,
          filePath: filePath.trim(),
          line: parseInt(lineStr, 10),
          column: parseInt(colStr, 10),
          symbolName,
        });
        continue;
      }

      // Check Runtime error
      const rtMatch = line.match(runtimeErrorRegex);
      if (rtMatch) {
        const [, errType, errMsg] = rtMatch;
        let classification: ErrorClassification = 'RUNTIME_ERROR';
        let symbolName: string | undefined;

        if (errMsg.includes('is not a function')) {
          classification = 'MISSING_PROPERTY';
          const fnMatch = errMsg.match(/([a-zA-Z0-9_$.]+)\s+is not a function/);
          if (fnMatch) symbolName = fnMatch[1];
        } else if (errMsg.includes('Cannot read properties of') || errMsg.includes('Cannot read property')) {
          classification = 'MISSING_PROPERTY';
          const propMatch = errMsg.match(/reading '([^']+)'/);
          if (propMatch) symbolName = propMatch[1];
        } else if (errType.includes('Assertion')) {
          classification = 'ASSERTION_FAILURE';
        }

        currentError = {
          classification,
          message: `${errType} ${errMsg.trim()}`,
          rawLine: line,
          symbolName,
        };

        // Look ahead for stack line or expected/received
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const nextLine = lines[j].trim();
          const expMatch = nextLine.match(expectedRegex);
          if (expMatch && currentError) {
            currentError.expected = expMatch[1].trim();
          }
          const recMatch = nextLine.match(receivedRegex);
          if (recMatch && currentError) {
            currentError.actual = recMatch[1].trim();
          }
          const stackMatch = nextLine.match(stackRegex);
          if (stackMatch && currentError && !currentError.filePath) {
            currentError.filePath = stackMatch[2];
            currentError.line = parseInt(stackMatch[3], 10);
            currentError.column = parseInt(stackMatch[4], 10);
          }
        }

        errors.push(currentError as ParsedError);
        currentError = null;
      }
    }

    return {
      rawOutput: output,
      errors,
      totalFailures: Math.max(errors.length, failedTestNames.length),
      failedTestNames,
    };
  }
}

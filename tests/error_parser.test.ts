import { describe, it, expect } from 'vitest';
import { ErrorParser } from '../src/sandbox/error_parser.js';

describe('ErrorParser', () => {
  it('should parse TypeScript compiler errors with file and line locations', () => {
    const raw = `
src/index.ts:24:18 - error TS2339: Property 'data' does not exist on type 'ChatCompletion'.
24     return response.data.choices;
                        ~~~~
    `;

    const report = ErrorParser.parse(raw);
    expect(report.errors.length).toBe(1);
    expect(report.errors[0].classification).toBe('MISSING_PROPERTY');
    expect(report.errors[0].filePath).toBe('src/index.ts');
    expect(report.errors[0].line).toBe(24);
    expect(report.errors[0].column).toBe(18);
    expect(report.errors[0].symbolName).toBe('data');
  });

  it('should parse Jest and Vitest test failure output', () => {
    const raw = `
FAIL src/ai.test.ts
  ✕ generates response (15ms)

  TypeError: openai.createChatCompletion is not a function
      at Object.generate (B:/app/src/ai.ts:12:15)
    `;

    const report = ErrorParser.parse(raw);
    expect(report.failedTestNames).toContain('generates response');
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0].message).toContain('is not a function');
  });
});

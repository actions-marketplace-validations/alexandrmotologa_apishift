import { describe, it, expect } from 'vitest';
import { PythonScanner } from '../src/scanner/python_scanner.js';
import { SpecIngestor } from '../src/spec/ingestor.js';

describe('PythonScanner', () => {
  it('should scan and mutate Python files for breaking changes', () => {
    const pythonCode = `
import openai

def get_answer(question):
    # Call chat endpoint
    response = openai.ChatCompletion.create(
        model_name="gpt-4",
        messages=[{"role": "user", "content": question}]
    )
    return response.data.choices[0].message.content
`;

    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');
    const scanResult = PythonScanner.scanFile('service.py', pythonCode, recipe);

    expect(scanResult.hasPythonImports).toBe(true);
    expect(scanResult.callsites.length).toBeGreaterThan(0);

    const mutateResult = PythonScanner.mutateFile('service.py', pythonCode, recipe);
    expect(mutateResult.hasChanges).toBe(true);
    expect(mutateResult.modifiedCode).toContain('openai.chat.completions.create');
    expect(mutateResult.modifiedCode).toContain('model="gpt-4"');
    expect(mutateResult.modifiedCode).toContain('# Call chat endpoint');
  });
});

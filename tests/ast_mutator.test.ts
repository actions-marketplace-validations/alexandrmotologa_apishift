import { describe, it, expect } from 'vitest';
import { AstMutator } from '../src/synthesizer/ast_mutator.js';
import { SpecIngestor } from '../src/spec/ingestor.js';

describe('AstMutator', () => {
  it('should transform AST nodes and preserve comments', () => {
    const code = `
      // Critical import
      import { Configuration, OpenAIApi } from 'openai';

      // Initialize config
      const configuration = new Configuration({ apiKey: '123' });
      const openai = new OpenAIApi(configuration);

      /* Main handler */
      async function ask() {
        const res = await openai.createChatCompletion({
          model_name: 'gpt-3.5-turbo',
          messages: []
        });
        return res.data.choices;
      }
    `;

    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');
    const result = AstMutator.mutateCode(code, recipe, 'ask.ts');

    expect(result.hasChanges).toBe(true);
    expect(result.appliedCount).toBeGreaterThanOrEqual(4);

    // Assert code transformations
    expect(result.modifiedCode).toContain('OpenAI');
    expect(result.modifiedCode).toContain('chat.completions.create');
    expect(result.modifiedCode).toContain("model: 'gpt-3.5-turbo'");
    expect(result.modifiedCode).toContain('res.choices');

    // Assert comments preserved
    expect(result.modifiedCode).toContain('// Critical import');
    expect(result.modifiedCode).toContain('// Initialize config');
    expect(result.modifiedCode).toContain('/* Main handler */');
  });
});

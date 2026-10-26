import { describe, it, expect } from 'vitest';
import { AstWalker } from '../src/scanner/ast_walker.js';
import { SpecIngestor } from '../src/spec/ingestor.js';

describe('AstWalker', () => {
  it('should locate method callsites and constructor instantiations', () => {
    const code = `
      import { Configuration, OpenAIApi } from 'openai';
      const config = new Configuration({ apiKey: 'test' });
      const openai = new OpenAIApi(config);

      async function run() {
        return await openai.createChatCompletion({
          model_name: 'gpt-4',
          messages: [{ role: 'user', content: 'hello' }]
        });
      }
    `;

    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');
    const result = AstWalker.scanFile('test.ts', code, recipe);

    expect(result.callsites.length).toBeGreaterThanOrEqual(3);

    const types = result.callsites.map(cs => cs.transformationType);
    expect(types).toContain('IMPORT_RENAME');
    expect(types).toContain('CLASS_INSTANTIATION_RENAME');
    expect(types).toContain('METHOD_RENAME');
  });
});

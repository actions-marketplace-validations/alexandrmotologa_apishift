import { describe, it, expect } from 'vitest';
import { SpecIngestor } from '../src/spec/ingestor.js';

describe('SpecIngestor', () => {
  it('should list all available built-in recipes', () => {
    const recipes = SpecIngestor.listBuiltinRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(4);

    const ids = recipes.map(r => r.id);
    expect(ids).toContain('openai-v0-to-v1');
    expect(ids).toContain('stripe-v12-to-v14');
    expect(ids).toContain('supabase-v1-to-v2');
    expect(ids).toContain('nextjs-pages-to-app');
  });

  it('should load a recipe by id', () => {
    const recipe = SpecIngestor.loadRecipe('openai-v0-to-v1');
    expect(recipe.packageName).toBe('openai');
    expect(recipe.fromVersion).toBe('0.28.0');
    expect(recipe.toVersion).toBe('1.0.0');
    expect(recipe.transformations.length).toBeGreaterThan(5);
  });

  it('should reject invalid recipe schemas', () => {
    expect(() => SpecIngestor.validate({})).toThrow();
    expect(() => SpecIngestor.validate({ id: 'bad' })).toThrow();
    expect(() => SpecIngestor.validate({ id: 'bad', packageName: 'pkg' })).toThrow();
  });
});

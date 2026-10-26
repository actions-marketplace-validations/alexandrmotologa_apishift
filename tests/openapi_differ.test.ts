import { describe, it, expect } from 'vitest';
import { OpenApiDiffer } from '../src/spec/openapi_differ.js';

describe('OpenApiDiffer', () => {
  it('should detect endpoint path changes and parameter renames', () => {
    const oldSpec = {
      openapi: '3.0.0',
      info: { title: 'CheckoutService', version: '1.0.0' },
      paths: {
        '/v1/charges': {
          post: {
            operationId: 'createCharge',
            parameters: [
              { name: 'amount', in: 'query', schema: { type: 'integer' } },
              { name: 'destination', in: 'query', schema: { type: 'string' } },
            ],
          },
        },
      },
    };

    const newSpec = {
      openapi: '3.0.0',
      info: { title: 'CheckoutService', version: '2.0.0' },
      paths: {
        '/v2/payment_intents': {
          post: {
            operationId: 'createPaymentIntent',
            parameters: [
              { name: 'amount', in: 'query', schema: { type: 'integer' } },
              { name: 'on_behalf_of', in: 'query', schema: { type: 'string' } },
            ],
          },
        },
      },
    };

    const diff = OpenApiDiffer.diff(oldSpec as any, newSpec as any);
    expect(diff.title).toBe('CheckoutService');
    expect(diff.oldVersion).toBe('1.0.0');
    expect(diff.newVersion).toBe('2.0.0');
    expect(diff.endpointChanges.length).toBeGreaterThan(0);

    const generated = diff.generatedRecipe;
    expect(generated.transformations.length).toBeGreaterThan(0);
    const methodRename = generated.transformations.find(t => t.type === 'METHOD_RENAME');
    expect(methodRename).toBeDefined();
    if (methodRename && methodRename.type === 'METHOD_RENAME') {
      expect(methodRename.from).toBe('createCharge');
      expect(methodRename.to).toBe('createPaymentIntent');
    }
  });
});

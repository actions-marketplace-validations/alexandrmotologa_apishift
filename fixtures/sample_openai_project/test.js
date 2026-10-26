const test = require('node:test');
const assert = require('node:assert');
const { openai, generateSummary } = require('./src/ai_service.js');

test('openai client contract matches modern OpenAI SDK', () => {
  // Legacy OpenAI client did not have chat.completions namespace
  assert.ok(openai, 'openai instance must exist');
  assert.ok(
    openai.chat && typeof openai.chat.completions?.create === 'function',
    'openai instance must expose modern chat.completions.create namespace'
  );
});

test('generateSummary calls chat.completions.create with model parameter', async () => {
  let capturedParams = null;

  // Mock chat.completions.create method
  openai.chat.completions.create = async (params) => {
    capturedParams = params;
    return {
      id: 'chatcmpl-test-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Summary successfully generated via modern OpenAI SDK',
          },
        },
      ],
    };
  };

  const output = await generateSummary('Need a fast migration tool');

  assert.ok(capturedParams, 'chat.completions.create must be called');
  assert.strictEqual(
    capturedParams.model,
    'gpt-3.5-turbo',
    'model_name parameter must be migrated to model'
  );
  assert.strictEqual(
    capturedParams.model_name,
    undefined,
    'legacy model_name must not be sent'
  );
  assert.strictEqual(
    output,
    'Summary successfully generated via modern OpenAI SDK',
    'Response message content must be extracted without .data wrapper'
  );
});

// Critical AI service for customer support summarization
// Maintainer: Alex M.
const {
  OpenAI
} = require('openai');

// Initialize API client configuration with timeout and auth
const configuration = {
  apiKey: process.env.OPENAI_API_KEY || 'sk-test-key-000'
};

// Construct client instance
const openai = new OpenAI(configuration);

/**
 * Summarize incoming user message with GPT model
 * @param {string} prompt User request text
 */
async function generateSummary(prompt) {
  // Call ChatCompletion endpoint
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a concise assistant.' },
      { role: 'user', content: prompt }
    ]
  });

  // Extract message content from legacy response shape
  return response.choices[0].message.content;
}

module.exports = {
  openai,
  generateSummary,
};

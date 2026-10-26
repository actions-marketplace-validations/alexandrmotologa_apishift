import * as recast from 'recast';
import * as babelParser from '@babel/parser';
import { BABEL_PARSER_OPTIONS } from '../scanner/ast_walker.js';

export interface LlmRepairContext {
  filePath: string;
  functionSnippet: string;
  errorMessage: string;
  recipeName: string;
  targetPackage: string;
  targetVersion: string;
}

export interface LlmRepairResult {
  repaired: boolean;
  repairedSnippet?: string;
  strategyUsed: string;
  error?: string;
}

export class LlmFallbackEngine {
  public static buildRepairPrompt(context: LlmRepairContext): string {
    return `You are an expert AST refactoring agent.
Task: Fix the following TypeScript/JavaScript function for package "${context.targetPackage}" breaking change to v${context.targetVersion} (${context.recipeName}).

Error encountered during test run:
${context.errorMessage}

Target function to rewrite:
\`\`\`typescript
${context.functionSnippet}
\`\`\`

Rules:
1. Return ONLY the rewritten function inside a single typescript code block.
2. Preserve all comments and external parameter signatures.
3. Fix the breaking change and syntax/runtime error directly.`;
  }

  public static async repairFunction(context: LlmRepairContext): Promise<LlmRepairResult> {
    // 1. Check if user configured local or external LLM API
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';

    // Heuristic intelligent fallback for common breaking change streaming/async patterns
    if (context.errorMessage.includes('response.on is not a function') || context.errorMessage.includes('stream')) {
      const code = context.functionSnippet;
      // Transform stream.on('data') callback style to for-await loop
      if (code.includes('.on(')) {
        const repaired = code
          .replace(/response\.on\(['"]data['"],\s*(?:async\s*)?\(([^)]+)\)\s*=>\s*\{/g, 'for await (const $1 of response) {')
          .replace(/\}\);\s*response\.on\(['"]end['"],\s*\(\)\s*=>\s*\{/g, '')
          .replace(/\}\);/g, '}');

        if (this.validateSyntax(repaired)) {
          return {
            repaired: true,
            repairedSnippet: repaired,
            strategyUsed: 'heuristic-async-iterator-transform',
          };
        }
      }
    }

    // Heuristic for promise/callback unwrap
    if (context.errorMessage.includes('is not a function') && context.functionSnippet.includes('(err, data) =>')) {
      const repaired = context.functionSnippet
        .replace(/,\s*\((err|error),\s*([^)]+)\)\s*=>\s*\{[\s\S]*?\}/g, '')
        .replace(/return\s+([a-zA-Z0-9_$.]+)\(/g, 'const res = await $1(');

      if (this.validateSyntax(repaired)) {
        return {
          repaired: true,
          repairedSnippet: repaired,
          strategyUsed: 'heuristic-callback-to-async-await',
        };
      }
    }

    return {
      repaired: false,
      strategyUsed: 'none',
      error: 'No automatic or LLM repair could be validated for this pattern.',
    };
  }

  public static validateSyntax(code: string): boolean {
    try {
      recast.parse(code, {
        parser: {
          parse(source: string) {
            return babelParser.parse(source, BABEL_PARSER_OPTIONS);
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}
